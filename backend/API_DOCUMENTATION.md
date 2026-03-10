# API Documentation

## Base URL

```text
http://localhost:3001/api
```

## Unified JSON response

### Success

```json
{
  "success": true,
  "data": {},
  "error": null,
  "meta": {}
}
```

### Error

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Message content is required",
    "details": null
  }
}
```

## Health

### `GET /health`

```json
{
  "status": "ok"
}
```

## Sessions

### `POST /sessions`
Create a new session.

### `GET /sessions`
List all sessions.

### `GET /sessions/:sessionId`
Get session detail.

Response shape:

```json
{
  "success": true,
  "data": {
    "session": {
      "id": "uuid",
      "title": "聊天标题",
      "status": "active",
      "createdAt": "2026-03-09T00:00:00.000Z",
      "updatedAt": "2026-03-09T00:00:00.000Z",
      "lastMessageAt": "2026-03-09T00:00:00.000Z",
      "lastReasonerRunAt": null,
      "messageCountSinceReasoner": 1,
      "profileVersion": 0,
      "isMinorFlagged": false,
      "privacyClearedAt": null,
      "preview": "新会话 · 2026/03/09 10:00"
    },
    "messages": [],
    "profile": null
  },
  "error": null
}
```

### `DELETE /sessions/:sessionId`
Delete one session and all related data.

### `DELETE /sessions/data`
Clear all sessions and related data.

### `POST /sessions/:sessionId/title`
Generate or refresh a session title.

## Messages / Chat

### `GET /sessions/:sessionId/messages`
Get ordered session messages.

### `POST /sessions/:sessionId/chat`
Send a user message and receive SSE stream.

Request:

```json
{
  "content": "你好"
}
```

SSE event payloads:

```text
data: {"type":"assistant_chunk","content":"..."}

data: {"type":"reasoner_started"}

data: {"type":"reasoner_chunk","content":"..."}

data: {"type":"profile_updated","data":{...}}

data: {"type":"reasoner_completed","jobId":"uuid","data":{...}}

data: {"type":"assistant_done"}

data: {"type":"done"}

data: {"type":"error","error":"..."}
```

## Profile

### `GET /sessions/:sessionId/profile`
Get current effective profile snapshot.

### `PATCH /sessions/:sessionId/profile`
Update profile fields manually.

Request example:

```json
{
  "personality": "外向、爱旅行"
}
```

### `GET /sessions/:sessionId/profile/revisions`
Get profile revision history.

### `POST /sessions/:sessionId/profile/analyze`
Trigger manual reasoner analysis.

Response shape:

```json
{
  "success": true,
  "data": {
    "jobId": "uuid",
    "profile": {},
    "revision": {}
  },
  "error": null
}
```

## Reasoner Jobs

### `GET /sessions/:sessionId/reasoner-jobs`
List reasoner jobs for one session.

### `GET /reasoner-jobs/:jobId`
Get one reasoner job.

## Export

### `GET /sessions/:sessionId/export/pdf`
Download the current profile snapshot as PDF.

## Error codes

Common values include:

- `VALIDATION_ERROR`
- `NOT_FOUND`
- `ROUTE_NOT_FOUND`
- `INTERNAL_ERROR`

## Notes

- Database schema is initialized by application startup code in `src/infrastructure/db/schema.ts`.
- Legacy tables such as `messages` and `profile_data` are no longer part of the active backend design.
