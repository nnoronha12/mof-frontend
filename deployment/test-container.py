"""Smoke-test an image with no network access outside its own container."""
import json,re,subprocess,sys,time
image=sys.argv[1] if len(sys.argv)>1 else 'mof-portal:phase1-review'
container=subprocess.check_output(['docker','run','--rm','-d','--network','none',image],text=True).strip()
def fetch(path):
 return subprocess.run(['docker','exec',container,'wget','-S','-O','-','http://127.0.0.1:8080'+path],capture_output=True)
try:
 for _ in range(20):
  home=fetch('/frontend/')
  if home.returncode==0:break
  time.sleep(.2)
 assert home.returncode==0,'Portal did not start'
 html=home.stdout
 assert b'max-age=0' in home.stderr,'HTML must revalidate'
 for path in ['/','/frontend/inquiry-document/example','/inquiry-document/example']:
  response=fetch(path);assert response.returncode==0 and response.stdout==html,'SPA route mismatch: '+path
 scripts=re.findall(rb'<script defer src="([^"]+)"',html)
 assert scripts and all(s.startswith(b'/frontend/') for s in scripts),'Incorrect asset mount'
 for script in scripts:
  path=script.decode();response=fetch(path)
  assert response.returncode==0 and response.stdout and not response.stdout.startswith(b'<!DOCTYPE'),'Script is not JavaScript'
  assert b'immutable' in response.stderr,'Hashed script cache missing'
  assert fetch(path.removeprefix('/frontend')).stdout==response.stdout,'Gateway prefix stripping fails'
 logo=fetch('/frontend/2961948.png');assert logo.stdout.startswith(b'\x89PNG'),'Missing logo'
 missing=fetch('/frontend/missing.12345678.js');assert missing.returncode!=0 and b'404' in missing.stderr,'Missing chunk must return 404'
 redirect=subprocess.run(['docker','exec',container,'wget','-S','-O','/dev/null','http://127.0.0.1:8080/frontend'],capture_output=True)
 assert b'308' in redirect.stderr and b'/frontend/' in redirect.stderr,'Missing canonical mount redirect'
 print(json.dumps({'image':image,'status':'PASS','checks':['startup','root and nested routes','prefixed and stripped assets','HTML revalidation','immutable chunks','logo','missing chunk 404','mount redirect']}))
finally:
 subprocess.run(['docker','rm','-f',container],stdout=subprocess.DEVNULL,check=True)
