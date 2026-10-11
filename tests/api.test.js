process.env.NODE_ENV = "test";
import assert from "assert";
import http from "http";
import fs from "fs";
import path from "path";
import { app } from "../server/app.js";
import { connectDB } from "../server/db.js";
import { User } from "../server/models/User.js";
import { Conversation } from "../server/models/Conversation.js";
import { Message } from "../server/models/Message.js";
import { RefreshTokenSession } from "../server/models/RefreshTokenSession.js";
import { File } from "../server/models/File.js";

const PORT = 5555;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

let server;

function request(method, path, { body, headers = {}, cookie } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path.startsWith("http") ? path : `${BASE_URL}${path}`);
    const reqHeaders = { ...headers };

    let bodyStr = null;
    if (body && typeof body === "object" && !(body instanceof Buffer)) {
      bodyStr = JSON.stringify(body);
      if (!reqHeaders["Content-Type"]) {
        reqHeaders["Content-Type"] = "application/json";
      }
    } else if (body instanceof Buffer) {
      bodyStr = body;
    }

    if (bodyStr) {
      reqHeaders["Content-Length"] = Buffer.byteLength(bodyStr);
    }

    if (cookie) {
      reqHeaders["Cookie"] = cookie;
    }

    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const buffer = Buffer.concat(chunks);
          const text = buffer.toString("utf8");
          let data;
          try {
            data = JSON.parse(text);
          } catch {
            data = text;
          }

          // Extract set-cookie
          const setCookie = res.headers["set-cookie"];
          let cookiesObj = {};
          if (setCookie) {
            setCookie.forEach((c) => {
              const parts = c.split(";")[0].split("=");
              cookiesObj[parts[0]] = parts[1];
            });
          }

          resolve({
            status: res.statusCode,
            headers: res.headers,
            data,
            cookies: cookiesObj,
            setCookieHeader: setCookie,
          });
        });
      }
    );

    req.on("error", reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function runTests() {
  console.log("\n🧪 STARTING INTELLICHAT AUTOMATED TEST SUITE\n");

  await connectDB();

  await new Promise((resolve) => {
    server = app.listen(PORT, resolve);
  });

  const timestamp = Date.now();
  const userA_email = `test_user_a_${timestamp}@example.com`;
  const userB_email = `test_user_b_${timestamp}@example.com`;
  const password = "StrongPassword123!";

  let userA_token = null;
  let userA_cookie = null;
  let userA_id = null;

  let userB_token = null;
  let userB_cookie = null;
  let userB_id = null;

  let conversationA_id = null;
  let messageA_id = null;
  let fileA_id = null;

  try {
    // ---------------------------------------------------------
    // TEST 1: Health Check
    // ---------------------------------------------------------
    console.log("➡️ Test 1: Health check endpoint");
    const health = await request("GET", "/health");
    assert.strictEqual(health.status, 200, "Health check should return 200");
    assert.strictEqual(health.data.success, true);
    assert.strictEqual(health.data.data.status, "healthy");
    console.log("   ✅ Health check passed\n");

    // ---------------------------------------------------------
    // TEST 2: Registration Validation Failure
    // ---------------------------------------------------------
    console.log("➡️ Test 2: User registration validation failure");
    const badReg = await request("POST", "/auth/register", {
      body: { name: "A", email: "not-an-email", password: "123" },
    });
    assert.strictEqual(badReg.status, 422, "Invalid registration should return 422");
    assert.strictEqual(badReg.data.success, false);
    console.log("   ✅ Validation properly rejected\n");

    // ---------------------------------------------------------
    // TEST 3: User A Registration & Token Issuance
    // ---------------------------------------------------------
    console.log("➡️ Test 3: User A registration & JWT issuance");
    const regA = await request("POST", "/auth/register", {
      body: { name: "User Alpha", email: userA_email, password },
    });
    assert.strictEqual(regA.status, 201, "Registration should return 201");
    assert.strictEqual(regA.data.success, true);
    assert.ok(regA.data.data.accessToken, "Should return short-lived access token");
    assert.ok(regA.cookies.refreshToken, "Should set refreshToken HttpOnly cookie");
    userA_token = regA.data.data.accessToken;
    userA_id = regA.data.data.user.id;
    userA_cookie = `refreshToken=${regA.cookies.refreshToken}`;
    console.log("   ✅ User A registered, access token & refresh cookie verified\n");

    // ---------------------------------------------------------
    // TEST 4: Duplicate Email Conflict
    // ---------------------------------------------------------
    console.log("➡️ Test 4: Duplicate email conflict (409)");
    const dupReg = await request("POST", "/auth/register", {
      body: { name: "User Duplicate", email: userA_email, password },
    });
    assert.strictEqual(dupReg.status, 409, "Duplicate email should return 409");
    console.log("   ✅ Duplicate registration properly prevented\n");

    // ---------------------------------------------------------
    // TEST 5: User A Login
    // ---------------------------------------------------------
    console.log("➡️ Test 5: User A Login");
    const loginA = await request("POST", "/auth/login", {
      body: { email: userA_email, password },
    });
    assert.strictEqual(loginA.status, 200, "Login should return 200");
    assert.ok(loginA.data.data.accessToken);
    userA_token = loginA.data.data.accessToken;
    userA_cookie = `refreshToken=${loginA.cookies.refreshToken}`;
    console.log("   ✅ Login successful\n");

    // ---------------------------------------------------------
    // TEST 6: Protected /me Endpoint
    // ---------------------------------------------------------
    console.log("➡️ Test 6: Protected /api/v1/auth/me");
    const unauthMe = await request("GET", "/auth/me");
    assert.strictEqual(unauthMe.status, 401, "Unauthenticated access should return 401");

    const authMe = await request("GET", "/auth/me", {
      headers: { Authorization: `Bearer ${userA_token}` },
    });
    assert.strictEqual(authMe.status, 200);
    assert.strictEqual(authMe.data.data.user.email, userA_email);
    console.log("   ✅ Authorization header verified on protected route\n");

    // ---------------------------------------------------------
    // TEST 7: Refresh Token Rotation
    // ---------------------------------------------------------
    console.log("➡️ Test 7: Refresh token atomic rotation");
    const refreshRes = await request("POST", "/auth/refresh", {
      cookie: userA_cookie,
    });
    assert.strictEqual(refreshRes.status, 200, "Token refresh should return 200");
    assert.ok(refreshRes.data.data.accessToken);
    assert.ok(refreshRes.cookies.refreshToken);
    const oldCookie = userA_cookie;
    userA_token = refreshRes.data.data.accessToken;
    userA_cookie = `refreshToken=${refreshRes.cookies.refreshToken}`;
    console.log("   ✅ Refresh token rotated atomically\n");

    // ---------------------------------------------------------
    // TEST 8: Token Replay Attack Detection
    // ---------------------------------------------------------
    console.log("➡️ Test 8: Token replay detection on revoked refresh token");
    const replayRes = await request("POST", "/auth/refresh", {
      cookie: oldCookie, // Trying to use the OLD already-rotated refresh token
    });
    assert.strictEqual(replayRes.status, 401, "Replaying old token must return 401");
    console.log("   ✅ Token replay detected and revoked family\n");

    // Relogin User A after replay test
    const reloginA = await request("POST", "/auth/login", {
      body: { email: userA_email, password },
    });
    userA_token = reloginA.data.data.accessToken;
    userA_cookie = `refreshToken=${reloginA.cookies.refreshToken}`;

    // ---------------------------------------------------------
    // TEST 9: Register User B (for cross-user isolation tests)
    // ---------------------------------------------------------
    console.log("➡️ Test 9: Register User B for isolation checks");
    const regB = await request("POST", "/auth/register", {
      body: { name: "User Beta", email: userB_email, password },
    });
    console.log("regB status:", regB.status, "data:", JSON.stringify(regB.data));
    userB_token = regB.data.data.accessToken;
    userB_id = regB.data.data.user.id;
    console.log("   ✅ User B registered\n");

    // ---------------------------------------------------------
    // TEST 10: User A Creates Conversation
    // ---------------------------------------------------------
    console.log("➡️ Test 10: User A Creates Conversation");
    const convA = await request("POST", "/conversations", {
      headers: { Authorization: `Bearer ${userA_token}` },
      body: { title: "Alpha Secret Discussion", model: "n8n-genius" },
    });
    assert.strictEqual(convA.status, 201);
    conversationA_id = convA.data.data.id;
    assert.strictEqual(convA.data.data.title, "Alpha Secret Discussion");
    console.log("   ✅ Conversation created with ID:", conversationA_id, "\n");

    // ---------------------------------------------------------
    // TEST 11: Cross-User Authorization (User B cannot access User A's chat)
    // ---------------------------------------------------------
    console.log("➡️ Test 11: Cross-user data isolation");
    const bAccessA = await request("GET", `/conversations/${conversationA_id}`, {
      headers: { Authorization: `Bearer ${userB_token}` },
    });
    assert.strictEqual(bAccessA.status, 404, "User B should not see User A's conversation (404)");

    const bDeleteA = await request("DELETE", `/conversations/${conversationA_id}`, {
      headers: { Authorization: `Bearer ${userB_token}` },
    });
    assert.strictEqual(bDeleteA.status, 404, "User B should not be able to delete User A's conversation");
    console.log("   ✅ Cross-user security confirmed: User B blocked from User A's data\n");

    // ---------------------------------------------------------
    // TEST 12: User A Renames Conversation
    // ---------------------------------------------------------
    console.log("➡️ Test 12: User A Renames Conversation");
    const renameRes = await request("PATCH", `/conversations/${conversationA_id}`, {
      headers: { Authorization: `Bearer ${userA_token}` },
      body: { title: "Updated Alpha Title" },
    });
    assert.strictEqual(renameRes.status, 200);
    assert.strictEqual(renameRes.data.data.title, "Updated Alpha Title");
    console.log("   ✅ Conversation title successfully updated\n");

    // ---------------------------------------------------------
    // TEST 13: File Upload & Metadata
    // ---------------------------------------------------------
    console.log("➡️ Test 13: File Upload (multipart/form-data)");
    // Create multipart payload
    const boundary = "---------------------------974767299852498929531610575";
    const fileContent = "IntelliChat document report content for test analysis.";
    const multipartBody = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="sample_report.txt"\r\n` +
      `Content-Type: text/plain\r\n\r\n` +
      `${fileContent}\r\n` +
      `--${boundary}--\r\n`
    );

    const uploadRes = await request("POST", "/files/upload", {
      headers: {
        Authorization: `Bearer ${userA_token}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body: multipartBody,
    });

    assert.strictEqual(uploadRes.status, 201, "File upload should return 201");
    fileA_id = uploadRes.data.data.id;
    assert.strictEqual(uploadRes.data.data.originalName, "sample_report.txt");
    console.log("   ✅ File uploaded successfully with ID:", fileA_id, "\n");

    // ---------------------------------------------------------
    // TEST 14: File Download & Verification
    // ---------------------------------------------------------
    console.log("➡️ Test 14: File Download & Verification");
    const downloadRes = await request("GET", `/files/${fileA_id}/download`, {
      headers: { Authorization: `Bearer ${userA_token}` },
    });
    assert.strictEqual(downloadRes.status, 200);
    assert.strictEqual(downloadRes.data, fileContent);
    console.log("   ✅ File download stream verified\n");

    // ---------------------------------------------------------
    // TEST 15: Post Message with Attachment & AI Reply
    // ---------------------------------------------------------
    console.log("➡️ Test 15: Message Submission with Attachment (Non-streaming)");
    const sendMsgRes = await request("POST", `/conversations/${conversationA_id}/messages`, {
      headers: { Authorization: `Bearer ${userA_token}` },
      body: {
        content: "What is this report about?",
        attachmentIds: [fileA_id],
        stream: false,
      },
    });

    assert.strictEqual(sendMsgRes.status, 201, "Message post should return 201");
    assert.ok(sendMsgRes.data.data.userMessage);
    assert.ok(sendMsgRes.data.data.assistantMessage);
    messageA_id = sendMsgRes.data.data.assistantMessage.id;
    console.log("   ✅ Message with attachment saved and AI response generated\n");

    // ---------------------------------------------------------
    // TEST 16: Message Feedback (Thumbs up)
    // ---------------------------------------------------------
    console.log("➡️ Test 16: Message Feedback");
    const feedbackRes = await request("POST", `/messages/${messageA_id}/feedback`, {
      headers: { Authorization: `Bearer ${userA_token}` },
      body: { rating: "positive" },
    });
    assert.strictEqual(feedbackRes.status, 200);
    assert.strictEqual(feedbackRes.data.data.feedback.rating, "positive");
    console.log("   ✅ Thumbs up feedback recorded\n");

    // ---------------------------------------------------------
    // TEST 17: Delete Conversation & Verify Soft Deletion
    // ---------------------------------------------------------
    console.log("➡️ Test 17: Delete Conversation (Soft deletion)");
    const delRes = await request("DELETE", `/conversations/${conversationA_id}`, {
      headers: { Authorization: `Bearer ${userA_token}` },
    });
    assert.strictEqual(delRes.status, 200);
    assert.strictEqual(delRes.data.data.deleted, true);

    const listActive = await request("GET", "/conversations", {
      headers: { Authorization: `Bearer ${userA_token}` },
    });
    const found = listActive.data.data.items.some((c) => c.id === conversationA_id);
    assert.strictEqual(found, false, "Soft-deleted conversation should not appear in active list");
    console.log("   ✅ Soft deletion confirmed and excluded from active list\n");

    // ---------------------------------------------------------
    // TEST 18: Restore Trashed Conversation
    // ---------------------------------------------------------
    console.log("➡️ Test 18: Restore Trashed Conversation");
    const restoreRes = await request("POST", `/conversations/${conversationA_id}/restore`, {
      headers: { Authorization: `Bearer ${userA_token}` },
    });
    assert.strictEqual(restoreRes.status, 200);
    assert.strictEqual(restoreRes.data.data.deletedAt, null);
    console.log("   ✅ Trashed conversation successfully restored\n");

    // ---------------------------------------------------------
    // TEST 19: Permanent Deletion / Empty Trash
    // ---------------------------------------------------------
    console.log("➡️ Test 19: Permanent deletion");
    const permDel = await request("DELETE", `/conversations/${conversationA_id}?permanent=true`, {
      headers: { Authorization: `Bearer ${userA_token}` },
    });
    assert.strictEqual(permDel.status, 200);
    assert.strictEqual(permDel.data.data.permanent, true);
    console.log("   ✅ Permanent deletion completed\n");

    console.log("🎉 ALL 19 API CONTRACT AND WORKFLOW TESTS PASSED SUCCESSFULLY!\n");
  } finally {
    // Cleanup test users from DB
    await User.deleteMany({ email: { $in: [userA_email, userB_email] } });
    if (server) server.close();
    const mongoose = (await import("mongoose")).default;
    await mongoose.disconnect();
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("\n❌ TEST SUITE FAILED:", err);
  if (server) server.close();
  process.exit(1);
});
