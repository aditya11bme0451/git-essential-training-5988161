# Now Assist Skill Kit skill: Submit Access Request (optional)

Use this if you want submission to be a reusable **Now Assist skill** (built in
the Now Assist Skill Kit) instead of, or alongside, the plain Script tool. The
AI agent then calls the skill as a tool of type **Now Assist skill**.

Path: **All → Now Assist Skill Kit → Home → Create skill**

## 1. Skill details

| Field | Value |
|---|---|
| Name | Submit Access Request |
| Description | Submits the access request catalog item and writes a short confirmation for the user. |
| Provider | Now LLM Service (or your configured provider) |

## 2. Inputs

| Name | Data type | Mandatory |
|---|---|---|
| requested_for_sys_id | String | Yes |
| action | String | Yes |
| comments | String | Yes |

## 3. Tool node (Skill tools → Add tool → Script)

Name the node `submit_request` and use this script. It runs **before** the
prompt, so the LLM only writes the confirmation text and never decides whether
to submit.

```javascript
(function runTool(context) {
    var res = new global.AccessRequestAgentUtils().submitRequest(
        context.requested_for_sys_id,
        context.action,
        context.comments
    );
    return JSON.stringify(res);
})(context);
```

## 4. Prompt

```
You are a ServiceNow assistant confirming the outcome of an access request.

Submission result (JSON):
{{submit_request.output}}

Instructions:
- If "status" is "ok", reply in at most two sentences: say the request was
  submitted, give the request_number (and ritm_number if present), and include
  the link.
- If "status" is "error", reply in one sentence explaining the "message" in
  plain language and suggest what the user should change.
- Do not invent any numbers or links that are not in the JSON.
```

## 5. Test, then publish

1. On the **Run tests** tab enter a real user sys_id, `add`, and a comment.
   Check that a REQ is created and the response quotes its number.
2. **Publish** the skill. In **Skill settings**, enable it for the
   **AI Agents** workflow so AI Agent Studio can see it.
3. In the agent, replace tool 3 with **Add tool → Now Assist skill → Submit
   Access Request**, mapping the three inputs. Keep it *Supervised*.
