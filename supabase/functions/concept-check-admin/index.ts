import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const STUDENT_EMAIL_DOMAIN = "students.conceptcheck.example";
const CLASS_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

type StudentInput = {
  display_name?: unknown;
  username?: unknown;
  password?: unknown;
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normaliseUsername(value: unknown): string {
  return cleanText(value).toLowerCase();
}

function validUsername(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{2,31}$/.test(value);
}

function validPassword(value: string): boolean {
  return value.length >= 8 && value.length <= 128;
}

function makeClassCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => CLASS_CODE_ALPHABET[byte % CLASS_CODE_ALPHABET.length]).join("");
}

function studentEmail(username: string): string {
  return `${username}@${STUDENT_EMAIL_DOMAIN}`;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { error: "Supabase function environment is incomplete." });
  }

  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return jsonResponse(401, { error: "Missing authentication token." });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const caller = userData?.user;

  if (userError || !caller) {
    return jsonResponse(401, { error: "Invalid or expired session." });
  }

  const { data: profile, error: profileError } = await admin
    .from("concept_check_profiles")
    .select("id, display_name, username, role")
    .eq("id", caller.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== "teacher") {
    return jsonResponse(403, { error: "Teacher access required." });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body." });
  }

  const action = cleanText(payload.action);

  try {
    if (action === "create_class") {
      const name = cleanText(payload.name);
      if (!name || name.length > 80) {
        return jsonResponse(400, { error: "Class name must be between 1 and 80 characters." });
      }

      let createdClass: { id: string; name: string; code: string } | null = null;

      for (let attempt = 0; attempt < 6; attempt += 1) {
        const code = makeClassCode();
        const { data, error } = await admin
          .from("concept_check_classes")
          .insert({ name, code, created_by: caller.id })
          .select("id, name, code")
          .single();

        if (!error) {
          createdClass = data;
          break;
        }

        if (error.code !== "23505") {
          return jsonResponse(400, { error: error.message });
        }
      }

      if (!createdClass) {
        return jsonResponse(500, { error: "Could not generate a unique class code." });
      }

      const { error: membershipError } = await admin
        .from("concept_check_memberships")
        .insert({
          class_id: createdClass.id,
          user_id: caller.id,
          username: profile.username || "teacher",
          role: "teacher",
        });

      if (membershipError) {
        await admin.from("concept_check_classes").delete().eq("id", createdClass.id);
        return jsonResponse(400, { error: membershipError.message });
      }

      return jsonResponse(201, { class: createdClass });
    }

    if (action === "bulk_create_students") {
      const classId = cleanText(payload.class_id);
      const students = payload.students;

      if (!classId) {
        return jsonResponse(400, { error: "Class is required." });
      }

      if (!Array.isArray(students) || students.length === 0 || students.length > 100) {
        return jsonResponse(400, { error: "Provide between 1 and 100 students." });
      }

      const { data: teacherMembership } = await admin
        .from("concept_check_memberships")
        .select("role")
        .eq("class_id", classId)
        .eq("user_id", caller.id)
        .maybeSingle();

      if (!teacherMembership || teacherMembership.role !== "teacher") {
        return jsonResponse(403, { error: "You do not own this class." });
      }

      const { data: classRow, error: classError } = await admin
        .from("concept_check_classes")
        .select("id")
        .eq("id", classId)
        .maybeSingle();

      if (classError || !classRow) {
        return jsonResponse(404, { error: "Class not found." });
      }

      const results: Array<Record<string, unknown>> = [];

      for (const rawStudent of students as StudentInput[]) {
        const displayName = cleanText(rawStudent.display_name);
        const username = normaliseUsername(rawStudent.username);
        const password = typeof rawStudent.password === "string" ? rawStudent.password : "";

        if (!displayName || displayName.length > 80) {
          results.push({ username, success: false, error: "Display name must be 1-80 characters." });
          continue;
        }

        if (!validUsername(username)) {
          results.push({
            username,
            success: false,
            error: "Username must be 3-32 characters using lowercase letters, numbers, dot, underscore, or hyphen.",
          });
          continue;
        }

        if (!validPassword(password)) {
          results.push({ username, success: false, error: "Password must be 8-128 characters." });
          continue;
        }

        const email = studentEmail(username);
        const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            concept_check: true,
            role: "student",
            display_name: displayName,
            username,
          },
        });

        if (createError || !createdUser.user) {
          results.push({
            username,
            success: false,
            error: createError?.message || "Could not create the account.",
          });
          continue;
        }

        const studentId = createdUser.user.id;

        const { error: profileInsertError } = await admin
          .from("concept_check_profiles")
          .insert({
            id: studentId,
            display_name: displayName,
            username,
            role: "student",
          });

        if (profileInsertError) {
          await admin.auth.admin.deleteUser(studentId);
          results.push({ username, success: false, error: profileInsertError.message });
          continue;
        }

        const { error: membershipInsertError } = await admin
          .from("concept_check_memberships")
          .insert({
            class_id: classId,
            user_id: studentId,
            username,
            role: "student",
          });

        if (membershipInsertError) {
          await admin.auth.admin.deleteUser(studentId);
          results.push({ username, success: false, error: membershipInsertError.message });
          continue;
        }

        results.push({ username, display_name: displayName, success: true });
      }

      const created = results.filter((result) => result.success).length;
      return jsonResponse(200, {
        created,
        failed: results.length - created,
        results,
      });
    }

    if (action === "reset_password") {
      const classId = cleanText(payload.class_id);
      const studentId = cleanText(payload.student_user_id);
      const password = typeof payload.password === "string" ? payload.password : "";

      if (!classId || !studentId) {
        return jsonResponse(400, { error: "Class and student are required." });
      }

      if (!validPassword(password)) {
        return jsonResponse(400, { error: "Password must be 8-128 characters." });
      }

      const { data: teacherMembership } = await admin
        .from("concept_check_memberships")
        .select("role")
        .eq("class_id", classId)
        .eq("user_id", caller.id)
        .maybeSingle();

      if (!teacherMembership || teacherMembership.role !== "teacher") {
        return jsonResponse(403, { error: "You do not own this class." });
      }

      const { data: studentMembership } = await admin
        .from("concept_check_memberships")
        .select("role")
        .eq("class_id", classId)
        .eq("user_id", studentId)
        .maybeSingle();

      if (!studentMembership || studentMembership.role !== "student") {
        return jsonResponse(404, { error: "Student is not in this class." });
      }

      const { error: updateError } = await admin.auth.admin.updateUserById(studentId, { password });
      if (updateError) {
        return jsonResponse(400, { error: updateError.message });
      }

      return jsonResponse(200, { success: true });
    }

    return jsonResponse(400, { error: "Unknown action." });
  } catch (error) {
    console.error("concept-check-admin failure:", error instanceof Error ? error.message : "Unknown error");
    return jsonResponse(500, { error: "Unexpected server error." });
  }
});
