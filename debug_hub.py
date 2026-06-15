import urllib.request, json
req = urllib.request.Request('http://localhost:8081/hub/api/users/seungyeon2', headers={'Authorization': 'token 56b5ee835deb58002bf1f53e322be423c264cc80271fdecdcb5eb67fcb1bfc4d'})
data = json.loads(urllib.request.urlopen(req).read())
servers = data.get('servers', {})
for name, s in servers.items():
    print(name, s.get('user_options'))
