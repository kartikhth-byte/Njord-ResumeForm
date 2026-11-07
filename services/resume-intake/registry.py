"""Private Holmes registry adapter; modern Supabase keys stay on apikey only."""
import os
import requests


class Registry:
    def __init__(self, url=None, key=None):
        self.url = (url or os.environ['SUPABASE_URL']).rstrip('/')
        key = key or os.environ['SUPABASE_SECRET_KEY']
        if not self.url.startswith('https://'): raise ValueError('registry_https_required')
        self.headers = {'apikey': key}
        if key.count('.') == 2 and not key.startswith('sb_'): self.headers['Authorization'] = 'Bearer ' + key
    def request(self, method, path, *, params=None, body=None):
        r = requests.request(method, self.url + '/rest/v1/' + path, params=params, json=body,
            headers={**self.headers, 'Prefer': 'return=representation'}, timeout=30)
        if not r.ok: raise RuntimeError('registry_operation_failed')
        return r.json() if r.content else None
    def rpc(self, name, body): return self.request('POST', 'rpc/' + name, body=body)
    def version(self, org, version):
        rows = self.request('GET', 'resume_versions', params={'id': 'eq.'+version, 'organization_id': 'eq.'+org, 'select': '*'})
        if len(rows) != 1: raise ValueError('resume_version_not_found')
        files = self.request('GET', 'resume_files', params={'id': 'eq.'+rows[0]['file_id'], 'organization_id':'eq.'+org,'select':'*'})
        if len(files) != 1: raise ValueError('resume_file_not_found')
        return rows[0], files[0]
    def extraction(self, version, engine):
        rows = self.request('GET', 'resume_extractions', params={'version_id':'eq.'+version,'extractor_version':'eq.'+engine,'select':'payload','order':'created_at.desc,id.desc','limit':'1'})
        return rows[0]['payload'] if rows else None
    def save_extraction(self, version, payload, *, retry=False):
        # Immutable versioned results; a retry of the same engine never rewrites evidence.
        if not retry and self.extraction(version, payload['extractor_version']) is not None: return
        self.request('POST', 'resume_extractions', body={'version_id':version,'extractor_version':payload['extractor_version'],
            'contract_version':payload['contract_version'],'payload':payload,'status':payload['status']})
