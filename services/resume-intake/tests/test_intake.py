"""Synthetic sources only; no network or production config is read."""
import hashlib
import io
import sys
import time
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock
import fitz
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives import serialization
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from basic_extractor import extract_pdf,VERSION
from app import create_app,scan_pdf
from registry import Registry

ORG='00000000-0000-4000-8000-0000000000a1';ACTOR='00000000-0000-4000-8000-000000000002'
VERSION_ID='00000000-0000-4000-8000-000000000010'
KEY=Ed25519PrivateKey.generate()
PUB=KEY.public_key().public_bytes(serialization.Encoding.PEM,serialization.PublicFormat.SubjectPublicKeyInfo)

def pdf(*pages):
    doc=fitz.open()
    for text in pages:doc.new_page().insert_text((50,60),text,fontsize=13)
    return doc.tobytes()

class MemoryRegistry:
    def __init__(self):self.files={};self.results={};self.history=[];self.events=set();self.claims=0
    def rpc(self,name,args):
        if name=='claim_platform_resume':
            self.claims+=1;digest=args['p_hash']
            f=self.files.setdefault(digest,{'id':digest,'filename':args['p_filename'],'content_hash':digest,'storage_status':'pending'})
            return {'file':f.copy(),'version':{'id':VERSION_ID}}
        if name=='finish_platform_resume':
            self.files[args['p_file']].update(storage_status='stored',drive_file_id=args['p_drive_id'])
        if name=='release_platform_resume':return
    def extraction(self,version,engine):return self.results.get((version,engine))
    def save_extraction(self,version,result,*,retry=False):
        self.results[(version,result['extractor_version'])]=result;self.history.append(result)
    def version(self,org,version):return {'id':version},next(iter(self.files.values()))
class MemoryDrive:
    def __init__(self):self.items={};self.writes=0
    def store(self,org,file_id,digest,content):
        self.writes+=1;self.items['drive_test']=content;return 'drive_test'
    def read(self,ref,digest):
        content=self.items[ref]
        if hashlib.sha256(content).hexdigest()!=digest:raise ValueError('original_hash_mismatch')
        return content

def token(purpose='upload',**extra):
    now=int(time.time());claims={'iss':'holmes','aud':'resume-intake','sub':ACTOR,'org':ORG,'role':'user','purpose':purpose,'iat':now,'exp':now+90,'jti':'test-request',**extra}
    return {'Authorization':'Bearer '+jwt.encode(claims,KEY,algorithm='EdDSA')}

@pytest.fixture
def setup():
    registry,drive=MemoryRegistry(),MemoryDrive();scanner=Mock()
    client=create_app(registry,drive,scanner=scanner,public_key=PUB).test_client()
    return client,registry,drive,scanner

def upload(client,content,headers=None):return client.post('/v1/upload',data={'file':(io.BytesIO(content),'synthetic.pdf')},headers=headers or token())

def test_all_pages_and_conflicts():
    result=extract_pdf(pdf('Name: Synthetic Platform Person\nEmail: first@example.invalid\nPresent Rank: Chief Officer', 'Email: second@example.invalid\nVessel Example 2020 to 2021 sea service evidence'))
    assert result['page_count']==2 and result['conflicts']==['email']
    assert result['pages'][1]['text'].startswith('<!-- page 2 -->')
    assert result['fields']['email'][1]['page']==2
    assert all(r['method']=='pdf_text' and r['evidence'] and 0<r['confidence']<=1 for rows in result['fields'].values() for r in rows)

def test_real_scanned_page_ocr(monkeypatch):
    monkeypatch.setenv('PATH','/opt/homebrew/bin:'+__import__('os').environ['PATH'])
    native=fitz.open(stream=pdf('Name: Synthetic Scan Person\nEmail: scan@example.invalid\nPresent Rank: Chief Officer'),filetype='pdf')
    scanned=fitz.open();p=scanned.new_page();p.insert_image(p.rect,pixmap=native[0].get_pixmap(matrix=fitz.Matrix(2,2)))
    result=extract_pdf(scanned.tobytes())
    assert result['pages'][0]['method']=='tesseract_ocr'
    assert result['fields']['email'][0]['value']=='scan@example.invalid'

def test_page_failure_accounted_and_blank_loud():
    result=extract_pdf(pdf('Name: Synthetic Native Person\nEmail: native@example.invalid\nPresent Rank: Chief Officer',''),ocr=Mock(side_effect=RuntimeError()))
    assert result['status']=='partial' and result['page_count']==2
    assert result['warnings']==[{'page':2,'code':'ocr_failed'}]
    assert result['pages'][1]['text'].startswith('<!-- page 2 -->')
    assert extract_pdf(pdf(''),ocr=lambda _: '')['status']=='failed'

def test_storage_repeat_review_only_and_no_private_pages(setup):
    client,registry,drive,scanner=setup
    content=pdf('Name: Synthetic Platform Person\nEmail: person@example.invalid\nPresent Rank: Chief Officer')
    a=upload(client,content);b=upload(client,content)
    assert a.status_code==b.status_code==200
    assert a.json['resume_version_id']==b.json['resume_version_id']
    assert drive.writes==1 and len(registry.events)==0 and scanner.call_count==2
    assert 'pages' not in a.json and a.json['status']=='needs_review'
    assert a.json['prefill']=={}  # Suggestions require explicit operator choice.

def test_ocr_failure_retains_original(setup):
    client,registry,drive,_=setup
    client=create_app(registry,drive,scanner=Mock(),extractor=Mock(side_effect=RuntimeError()),public_key=PUB).test_client()
    r=upload(client,pdf('Synthetic content to retain even when OCR unexpectedly fails'))
    assert r.status_code==200 and r.json['status']=='failed' and drive.writes==1
    assert len(registry.events)==0

def test_malware_rejected_before_store(setup):
    _,registry,drive,_=setup
    client=create_app(registry,drive,scanner=Mock(side_effect=ValueError('unsafe_pdf_rejected')),public_key=PUB).test_client()
    assert upload(client,pdf('Synthetic')).status_code==400
    assert drive.writes==registry.claims==0

def test_changed_drive_original_never_overwritten(setup):
    client,registry,drive,_=setup;content=pdf('Synthetic original has enough embedded text for native extraction.')
    assert upload(client,content).status_code==200
    drive.items['drive_test']=b'changed'
    assert upload(client,content).json['error']=='original_hash_mismatch'
    assert drive.writes==1

@pytest.mark.parametrize('claims',[{'aud':'needle-api'},{'org':'00000000-0000-4000-8000-000000000099'},{'role':'viewer'},{'purpose':'view'},{'exp':int(time.time())-100}])
def test_auth_scope(setup,claims):
    assert upload(setup[0],pdf('Synthetic'),token(**claims)).status_code==401

def test_exact_view_and_import_scope(setup):
    client,_,drive,_=setup;content=pdf('Synthetic source for scoped import with no copy to Drive.');digest=hashlib.sha256(content).hexdigest();drive.items['original_test']=content
    body={'resume_id':digest,'drive_file_id':'original_test','filename':'source.pdf'}
    assert client.post('/v1/import',json=body,headers=token('import',resume_ids=['0'*64])).status_code==403
    r=client.post('/v1/import',json=body,headers=token('import',resume_ids=[digest]))
    assert r.status_code==200 and drive.writes==0
    assert client.get('/v1/versions/'+VERSION_ID+'/pdf',headers=token('view',resume_version_id=VERSION_ID)).data==content
    assert client.get('/v1/versions/'+VERSION_ID+'/pdf',headers=token('view',resume_version_id='wrong')).status_code==403

def test_scanner_missing_fails_closed(monkeypatch):
    monkeypatch.setattr('app.subprocess.run',Mock(side_effect=FileNotFoundError()))
    with pytest.raises(RuntimeError,match='malware_scanner_unavailable'):scan_pdf(pdf('Synthetic'))

def test_registry_key_headers():
    assert Registry('https://staging.example.invalid','sb_secret_test').headers=={'apikey':'sb_secret_test'}
    assert Registry('https://staging.example.invalid','a.b.c').headers['Authorization']=='Bearer a.b.c'


def test_explicit_retry_appends_and_checks_scope(setup):
    client,registry,drive,_=setup
    content=pdf('Name: Synthetic Retry Person\nEmail: retry@example.invalid\nPresent Rank: Chief Officer')
    assert upload(client,content).status_code==200
    r=client.post('/v1/versions/'+VERSION_ID+'/extract',json={},headers=token('extract',resume_version_id=VERSION_ID))
    assert r.status_code==200 and len(registry.history)==2 and drive.writes==1
    assert client.post('/v1/versions/'+VERSION_ID+'/extract',json={},headers=token('extract',resume_version_id='wrong')).status_code==403

def test_page_limit_fails_before_any_storage(setup):
    client,registry,drive,_=setup
    doc=fitz.open()
    for i in range(101):doc.new_page()
    assert upload(client,doc.tobytes()).status_code==400
    assert registry.claims==drive.writes==0
