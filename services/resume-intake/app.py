"""Platform Resume Intake service. Called only by the authenticated Holmes API.

Originals live in private Drive. The registry/evidence live in Holmes Supabase.
All local files (scanner/OCR) use a private temporary directory and are removed.
"""
import hashlib
import os
import re
import subprocess
import tempfile
import uuid
from pathlib import Path
import fitz
import jwt
from flask import Flask, Response, g, jsonify, request
from basic_extractor import extract_pdf, CONTRACT, VERSION, MAX_PAGES
from drive import Drive
from registry import Registry


def scan_pdf(content):
    # This default is mandatory in deployed service. Tests inject their own
    # scanner; no environment switch silently disables production scanning.
    with tempfile.TemporaryDirectory(prefix='holmes-scan-') as tmp:
        path=Path(tmp)/'original.pdf';path.write_bytes(content)
        try: result=subprocess.run(['clamscan','--no-summary',str(path)],capture_output=True,timeout=30)
        except (OSError,subprocess.TimeoutExpired) as exc: raise RuntimeError('malware_scanner_unavailable') from exc
        if result.returncode==1: raise ValueError('unsafe_pdf_rejected')
        if result.returncode!=0: raise RuntimeError('malware_scanner_unavailable')
    with fitz.open(stream=content,filetype='pdf') as pdf:
        for xref in range(1,pdf.xref_length()):
            obj=pdf.xref_object(xref,compressed=True)
            if re.search(r'/(?:JavaScript|JS|Launch|RichMedia|EmbeddedFile)\b',obj):raise ValueError('active_pdf_rejected')
        for page in pdf:
            if any(link.get('uri','').lower().startswith(('javascript:','file:')) for link in page.get_links()):
                raise ValueError('active_pdf_rejected')
        if pdf.embfile_count(): raise ValueError('embedded_files_rejected')


def create_app(registry=None, drive=None, scanner=scan_pdf, extractor=extract_pdf, public_key=None):
    app=Flask(__name__);app.config['MAX_CONTENT_LENGTH']=10*1024*1024+65536
    registry=registry or Registry();drive=drive or Drive()
    @app.before_request
    def authorize():
        if request.path=='/healthz':return None
        token=request.headers.get('Authorization','')
        if not token.startswith('Bearer '):return jsonify(error='service_authorization_required'),401
        try:
            claims=jwt.decode(token[7:],public_key or os.environ['RESUME_INTAKE_PUBLIC_KEY'].replace('\\n','\n'),algorithms=['EdDSA'],
                audience='resume-intake',issuer='holmes',leeway=5,options={'require':['exp','iat','jti','sub','org','purpose']})
            for key in ('sub','org'):uuid.UUID(claims[key])
            if claims['exp']-claims['iat']>120 or claims['org']!=os.environ.get('RESUME_INTAKE_ORG_ID','00000000-0000-4000-8000-0000000000a1'):raise ValueError()
            purpose='view' if request.method=='GET' else 'extract' if request.path.endswith('/extract') else 'import' if request.path=='/v1/import' else 'upload'
            if claims['purpose']!=purpose or claims.get('role') not in ({'viewer','user','admin'} if purpose=='view' else {'user','admin'}):raise ValueError()
            g.identity=claims
        except Exception:return jsonify(error='service_authorization_rejected'),401
    @app.get('/healthz')
    def health():return jsonify(ok=True,contract_version=CONTRACT,extractor_version=VERSION)
    def public_result(version,payload,digest,filename):
        return {'resume_id':digest,'resume_version_id':version,'filename':filename,'status':payload['status'],
            'contract_version':CONTRACT,'extractor_version':payload['extractor_version'],'original_available':True,
            'fields':payload['fields'],'conflicts':payload['conflicts'],'warnings':payload['warnings'],
            'page_count':payload['page_count'],'indexing_status':'awaiting_identity_review','prefill':{}}
    def register(content,filename,source='holmes_upload',original_ref=None):
        if not content.startswith(b'%PDF-') or len(content)>10485760:raise ValueError('pdf_10mb_limit')
        with fitz.open(stream=content,filetype='pdf') as pdf:
            if pdf.needs_pass or not 1<=pdf.page_count<=MAX_PAGES:raise ValueError('unlocked_pdf_with_1_to_100_pages_required')
        scanner(content)
        org,actor=g.identity['org'],g.identity['sub'];digest=hashlib.sha256(content).hexdigest();lease=str(uuid.uuid4())
        claimed=registry.rpc('claim_platform_resume',{'p_org':org,'p_hash':digest,'p_filename':filename[:250],
            'p_size':len(content),'p_source':source,'p_actor':actor,'p_lease':lease,'p_external_id':original_ref})
        file,version=claimed['file'],claimed['version']
        try:
            drive_id=file.get('drive_file_id')
            if drive_id:
                drive.read(drive_id,digest)  # Detect externally modified originals even on a repeated upload.
            else:
                drive_id=original_ref or drive.store(org,file['id'],digest,content)
            # Existing originals were hash-verified during import/read. A repeated
            # upload uses the canonical stored location; never overwrites it.
            registry.rpc('finish_platform_resume',{'p_file':file['id'],'p_lease':lease,'p_drive_id':drive_id})
            payload=registry.extraction(version['id'],VERSION)
            if payload is None:
                try:payload=extractor(content)
                except Exception:payload={'contract_version':CONTRACT,'extractor_version':VERSION,'status':'failed',
                    'fields':{},'conflicts':[],'pages':[],'warnings':[{'code':'basic_extraction_failed'}],'page_count':None}
                registry.save_extraction(version['id'],payload)
            return jsonify(public_result(version['id'],payload,digest,file['filename']))
        finally:
            registry.rpc('release_platform_resume',{'p_file':file['id'],'p_lease':lease})
    @app.post('/v1/upload')
    def upload():
        file=request.files.get('file')
        if file is None:return jsonify(error='pdf_required'),400
        filename=Path(file.filename or 'resume.pdf').name
        return register(file.read(10485761),filename)
    @app.post('/v1/import')
    def import_existing():
        body=request.get_json(silent=True)
        if not isinstance(body,dict):return jsonify(error='invalid_import'),400
        digest=body.get('resume_id','');ref=body.get('drive_file_id','')
        if not re.fullmatch('[a-f0-9]{64}',digest) or digest not in g.identity.get('resume_ids',[]):return jsonify(error='source_scope_rejected'),403
        content=drive.read(ref,digest)
        return register(content,Path(body.get('filename') or 'resume.pdf').name,'needle_corpus',ref)
    @app.post('/v1/versions/<version>/extract')
    def retry_extract(version):
        if version!=g.identity.get('resume_version_id'):return jsonify(error='file_scope_rejected'),403
        v,file=registry.version(g.identity['org'],version)
        if file['storage_status']!='stored':return jsonify(error='original_unavailable'),409
        content=drive.read(file['drive_file_id'],file['content_hash']);scanner(content)
        payload=extractor(content)  # A failure is loud; the previous attempt remains immutable.
        registry.save_extraction(version,payload,retry=True)
        return jsonify(public_result(version,payload,file['content_hash'],file['filename']))
    @app.get('/v1/versions/<version>/pdf')
    def pdf(version):
        if version!=g.identity.get('resume_version_id'):return jsonify(error='file_scope_rejected'),403
        v,file=registry.version(g.identity['org'],version)
        if file['storage_status']!='stored':return jsonify(error='original_unavailable'),409
        content=drive.read(file['drive_file_id'],file['content_hash'])
        return Response(content,mimetype='application/pdf',headers={'Content-Disposition':'inline; filename="resume.pdf"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'})
    @app.errorhandler(ValueError)
    def invalid(error):return jsonify(error=str(error) if re.fullmatch('[a-z0-9_]+',str(error)) else 'invalid_pdf'),400
    @app.errorhandler(Exception)
    def unavailable(error):
        # Never log raw bodies, extraction text, tokens or upstream errors.
        if getattr(error,'code',None)==413:return jsonify(error='pdf_10mb_limit'),413
        app.logger.warning('Resume intake operation unavailable: %s',type(error).__name__)
        return jsonify(error='resume_intake_unavailable_original_retained_if_stored'),503
    return app

if __name__=='__main__':create_app().run(host='127.0.0.1',port=int(os.environ.get('PORT','5210')))
