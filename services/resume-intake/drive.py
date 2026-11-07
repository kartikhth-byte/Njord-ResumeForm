"""Platform-owned immutable Drive transport. No filename-based replacement."""
import hashlib
import json
import os
import re
import uuid
import requests


class Drive:
    def __init__(self):
        self.folder = os.environ['RESUME_INTAKE_DRIVE_FOLDER_ID']
        if not re.fullmatch(r'[A-Za-z0-9_-]{5,200}', self.folder): raise ValueError('invalid_private_folder')
    def token(self):
        r = requests.post('https://oauth2.googleapis.com/token', data={'grant_type':'refresh_token',
            'refresh_token':os.environ['RESUME_INTAKE_DRIVE_REFRESH_TOKEN'],
            'client_id':os.environ['RESUME_INTAKE_DRIVE_CLIENT_ID'],'client_secret':os.environ['RESUME_INTAKE_DRIVE_CLIENT_SECRET']}, timeout=20)
        if not r.ok: raise RuntimeError('drive_auth_unavailable')
        return r.json()['access_token']
    def read(self, file_id, expected_hash, max_size=10485760):
        if not re.fullmatch(r'[A-Za-z0-9_-]{5,200}', file_id): raise ValueError('invalid_original_reference')
        r = requests.get('https://www.googleapis.com/drive/v3/files/'+file_id,
            params={'alt':'media','supportsAllDrives':'true'},headers={'Authorization':'Bearer '+self.token()},stream=True,timeout=60)
        try:
            if not r.ok: raise RuntimeError('drive_read_unavailable')
            chunks, size = [], 0
            for chunk in r.iter_content(65536):
                size += len(chunk)
                if size > max_size: raise ValueError('original_size_limit')
                chunks.append(chunk)
            content = b''.join(chunks)
            if hashlib.sha256(content).hexdigest() != expected_hash: raise ValueError('original_hash_mismatch')
            return content
        finally: r.close()
    def store(self, org, file_id, digest, content):
        token = self.token();headers={'Authorization':'Bearer '+token}
        query=f"'{self.folder}' in parents and trashed = false and appProperties has {{ key='platform_file_id' and value='{file_id}' }}"
        r=requests.get('https://www.googleapis.com/drive/v3/files',params={'q':query,'fields':'files(id)','supportsAllDrives':'true','includeItemsFromAllDrives':'true'},headers=headers,timeout=30)
        if not r.ok: raise RuntimeError('drive_lookup_unavailable')
        matches=r.json().get('files',[])
        if len(matches)>1: raise RuntimeError('orphan_conflict_requires_review')
        if matches:
            self.read(matches[0]['id'],digest,len(content));return matches[0]['id']
        boundary='resume-'+uuid.uuid4().hex
        metadata={'name':str(file_id)+'.pdf','parents':[self.folder],
            'appProperties':{'platform_file_id':str(file_id),'organization_id':org,'sha256':digest}}
        body=(f'--{boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+json.dumps(metadata)+
            f'\r\n--{boundary}\r\nContent-Type: application/pdf\r\n\r\n').encode()+content+f'\r\n--{boundary}--\r\n'.encode()
        r=requests.post('https://www.googleapis.com/upload/drive/v3/files',params={'uploadType':'multipart','supportsAllDrives':'true','fields':'id'},
            headers={**headers,'Content-Type':'multipart/related; boundary='+boundary},data=body,timeout=60)
        if not r.ok: raise RuntimeError('drive_write_unavailable')
        return r.json()['id']
