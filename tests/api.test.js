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
  console.log("Running API tests...\n");

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
    const health = await request("GET", "/health");
    assert.strictEqual(health.status, 200);
    assert.strictEqual(health.data.status, "ok");
    console.log("  ✓ GET /health");

    const badReg = await request("POST", "/auth/register", {
      body: { name: "A", email: "not-an-email", password: "123" },
    });
    assert.strictEqual(badReg.status, 422);
    assert.strictEqual(badReg.data.success, false);
    console.log("  ✓ POST /auth/register validation");

    const regA = await request("POST", "/auth/register", {
      body: { name: "User Alpha", email: userA_email, password },
    });
    assert.strictEqual(regA.status, 201);
    assert.strictEqual(regA.data.success, true);
    assert.ok(regA.data.data.accessToken);
    assert.ok(regA.cookies.refreshToken);
    userA_token = regA.data.data.accessToken;
    userA_id = regA.data.data.user.id;
    userA_cookie = `refreshToken=${regA.cookies.refreshToken}`;
    console.log("  ✓ POST /auth/register success");

    const dupReg = await request("POST", "/auth/register", {
      body: { name: "User Duplicate", email: userA_email, password },
    });
    assert.strictEqual(dupReg.status, 409);
    console.log("  ✓ POST /auth/register duplicate rejection");

    const loginA = await request("POST", "/auth/login", {
      body: { email: userA_email, password },
    });
    assert.strictEqual(loginA.status, 200);
    assert.ok(loginA.data.data.accessToken);
    userA_token = loginA.data.data.accessToken;
    userA_cookie = `refreshToken=${loginA.cookies.refreshToken}`;
    console.log("  ✓ POST /auth/login");

    const unauthMe = await request("GET", "/auth/me");
    assert.strictEqual(unauthMe.status, 401);

    const authMe = await request("GET", "/auth/me", {
      headers: { Authorization: `Bearer ${userA_token}` },
    });
    assert.strictEqual(authMe.status, 200);
    assert.strictEqual(authMe.data.data.user.email, userA_email);
    console.log("  ✓ GET /auth/me authentication");

    const refreshRes = await request("POST", "/auth/refresh", {
      cookie: userA_cookie,
    });
    assert.strictEqual(refreshRes.status, 200);
    assert.ok(refreshRes.data.data.accessToken);
    assert.ok(refreshRes.cookies.refreshToken);
    const oldCookie = userA_cookie;
    userA_token = refreshRes.data.data.accessToken;
    userA_cookie = `refreshToken=${refreshRes.cookies.refreshToken}`;
    console.log("  ✓ POST /auth/refresh rotation");

    const replayRes = await request("POST", "/auth/refresh", {
      cookie: oldCookie,
    });
    assert.strictEqual(replayRes.status, 401);
    console.log("  ✓ POST /auth/refresh reuse protection");

    const reloginA = await request("POST", "/auth/login", {
      body: { email: userA_email, password },
    });
    userA_token = reloginA.data.data.accessToken;
    userA_cookie = `refreshToken=${reloginA.cookies.refreshToken}`;

    const regB = await request("POST", "/auth/register", {
      body: { name: "User Beta", email: userB_email, password },
    });
    userB_token = regB.data.data.accessToken;
    userB_id = regB.data.data.user.id;

    const convA = await request("POST", "/conversations", {
      headers: { Authorization: `Bearer ${userA_token}` },
      body: { title: "Alpha Discussion", model: "n8n-genius" },
    });
    assert.strictEqual(convA.status, 201);
    conversationA_id = convA.data.data.id;
    console.log("  ✓ POST /conversations");

    const bAccessA = await request("GET", `/conversations/${conversationA_id}`, {
      headers: { Authorization: `Bearer ${userB_token}` },
    });
    assert.strictEqual(bAccessA.status, 404);

    const bDeleteA = await request("DELETE", `/conversations/${conversationA_id}`, {
      headers: { Authorization: `Bearer ${userB_token}` },
    });
    assert.strictEqual(bDeleteA.status, 404);
    console.log("  ✓ Cross-user isolation");

    const renameRes = await request("PATCH", `/conversations/${conversationA_id}`, {
      headers: { Authorization: `Bearer ${userA_token}` },
      body: { title: "Updated Alpha Title" },
    });
    assert.strictEqual(renameRes.status, 200);
    assert.strictEqual(renameRes.data.data.title, "Updated Alpha Title");
    console.log("  ✓ PATCH /conversations/:id rename");

    const boundary = "---------------------------974767299852498929531610575";
    const fileContent = "Document content for test analysis.";
    const multipartBody = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="sample.txt"\r\n` +
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

    assert.strictEqual(uploadRes.status, 201);
    fileA_id = uploadRes.data.data.id;
    console.log("  ✓ POST /files/upload");

    const downloadRes = await request("GET", `/files/${fileA_id}/download`, {
      headers: { Authorization: `Bearer ${userA_token}` },
    });
    assert.strictEqual(downloadRes.status, 200);
    assert.strictEqual(downloadRes.data, fileContent);
    console.log("  ✓ GET /files/:id/download");

    const sendMsgRes = await request("POST", `/conversations/${conversationA_id}/messages`, {
      headers: { Authorization: `Bearer ${userA_token}` },
      body: {
        content: "What is this report about?",
        attachmentIds: [fileA_id],
        stream: false,
      },
    });

    assert.strictEqual(sendMsgRes.status, 201);
    assert.ok(sendMsgRes.data.data.userMessage);
    assert.ok(sendMsgRes.data.data.assistantMessage);
    messageA_id = sendMsgRes.data.data.assistantMessage.id;
    console.log("  ✓ POST /conversations/:id/messages");

    const feedbackRes = await request("POST", `/messages/${messageA_id}/feedback`, {
      headers: { Authorization: `Bearer ${userA_token}` },
      body: { rating: "positive" },
    });
    assert.strictEqual(feedbackRes.status, 200);
    assert.strictEqual(feedbackRes.data.data.feedback.rating, "positive");
    console.log("  ✓ POST /messages/:id/feedback");

    const delRes = await request("DELETE", `/conversations/${conversationA_id}`, {
      headers: { Authorization: `Bearer ${userA_token}` },
    });
    assert.strictEqual(delRes.status, 200);
    assert.strictEqual(delRes.data.data.deleted, true);

    const listActive = await request("GET", "/conversations", {
      headers: { Authorization: `Bearer ${userA_token}` },
    });
    const found = listActive.data.data.items.some((c) => c.id === conversationA_id);
    assert.strictEqual(found, false);
    console.log("  ✓ Soft delete conversation");

    const restoreRes = await request("POST", `/conversations/${conversationA_id}/restore`, {
      headers: { Authorization: `Bearer ${userA_token}` },
    });
    assert.strictEqual(restoreRes.status, 200);
    assert.strictEqual(restoreRes.data.data.deletedAt, null);
    console.log("  ✓ POST /conversations/:id/restore");

    const permDel = await request("DELETE", `/conversations/${conversationA_id}?permanent=true`, {
      headers: { Authorization: `Bearer ${userA_token}` },
    });
    assert.strictEqual(permDel.status, 200);
    assert.strictEqual(permDel.data.data.permanent, true);
    console.log("  ✓ DELETE /conversations/:id (permanent)");

    console.log("\nAll 19 tests passed.\n");
  } finally {
    // Cleanup test users from DB
    await User.deleteMany({ email: { $in: [userA_email, userB_email] } });
    const mongoose = (await import("mongoose")).default;
    await mongoose.disconnect();
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  }
}

runTests().catch((err) => {
  console.error("\n❌ TEST SUITE FAILED:", err);
  if (server) server.close();
  process.exit(1);
});
