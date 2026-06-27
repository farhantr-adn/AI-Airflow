# Auth-Gated App Testing Playbook (Forge - AI CI/CD Platform)

## Step 1: Create Test User & Session via Mongo
```
mongosh --eval "
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  auth_provider: 'google',
  role: 'admin',
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

## Step 2: Test Backend API
```
curl -X GET "$REACT_APP_BACKEND_URL/api/auth/me" \
  -H "Authorization: Bearer SESSION_TOKEN"
```

## Step 3: Browser Testing
Set the session cookie before navigating:
```
await page.context.add_cookies([{
  "name": "session_token",
  "value": "YOUR_SESSION_TOKEN",
  "domain": "<host>",
  "path": "/",
  "httpOnly": true,
  "secure": true,
  "sameSite": "None"
}]);
```

## Checklist
- User has `user_id` (UUID), not `_id`
- Session `user_id` matches user `user_id`
- `/api/auth/me` returns user data via cookie OR Authorization header
- Dashboard loads after auth without redirect
