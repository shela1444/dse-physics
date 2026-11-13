(function () {
    "use strict";

    const config = window.CONCEPT_CHECK_CONFIG;
    const supabaseFactory = window.supabase;

    if (!config || !supabaseFactory || typeof supabaseFactory.createClient !== "function") {
        console.error("Concept Check auth configuration is unavailable.");
        return;
    }

    const client = supabaseFactory.createClient(config.supabaseUrl, config.publishableKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false
        }
    });

    const ACTIVE_CLASS_PREFIX = "cc_active_class_";
    let initPromise = null;

    function normalizeUsername(value) {
        return String(value || "").trim().toLowerCase();
    }

    function studentEmail(username) {
        return normalizeUsername(username) + "@" + config.studentEmailDomain;
    }

    function currentPath() {
        return window.location.pathname + window.location.search + window.location.hash;
    }

    function safeNext(rawNext, fallback) {
        if (!rawNext) return fallback;
        try {
            const parsed = new URL(rawNext, window.location.href);
            if (parsed.origin !== window.location.origin) return fallback;
            return parsed.pathname + parsed.search + parsed.hash;
        } catch {
            return fallback;
        }
    }

    function loginUrl(options = {}) {
        const params = new URLSearchParams();
        const next = options.next || currentPath();
        if (next) params.set("next", next);
        if (options.mode === "teacher") params.set("role", "teacher");
        if (options.error) params.set("error", options.error);
        return "login.html?" + params.toString();
    }

    async function getSession() {
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        return data.session || null;
    }

    async function fetchProfile(userId) {
        const { data, error } = await client
            .from("concept_check_profiles")
            .select("id, display_name, username, role")
            .eq("id", userId)
            .maybeSingle();

        if (error) throw error;
        return data || null;
    }

    async function fetchMemberships(userId) {
        const { data, error } = await client
            .from("concept_check_memberships")
            .select("class_id, user_id, username, role, joined_at")
            .eq("user_id", userId)
            .order("joined_at", { ascending: true });

        if (error) throw error;
        return data || [];
    }

    async function getContext() {
        const session = await getSession();
        if (!session || !session.user) return null;

        const [profile, memberships] = await Promise.all([
            fetchProfile(session.user.id),
            fetchMemberships(session.user.id)
        ]);

        return {
            session,
            user: session.user,
            profile,
            memberships
        };
    }

    function activeClassFor(context) {
        if (!context || !context.user) return null;
        const studentMemberships = context.memberships.filter((membership) => membership.role === "student");
        if (!studentMemberships.length) return null;

        const stored = localStorage.getItem(ACTIVE_CLASS_PREFIX + context.user.id);
        const storedMembership = studentMemberships.find((membership) => membership.class_id === stored);
        if (storedMembership) return storedMembership.class_id;

        localStorage.setItem(ACTIVE_CLASS_PREFIX + context.user.id, studentMemberships[0].class_id);
        return studentMemberships[0].class_id;
    }

    async function signInStudent({ username, password }) {
        const user = normalizeUsername(username);

        if (!user || !password) {
            throw new Error("Enter your username and password.");
        }

        const { data, error } = await client.auth.signInWithPassword({
            email: studentEmail(user),
            password
        });

        if (error || !data.user) {
            throw new Error("Username or password is incorrect.");
        }

        let context;
        try {
            context = await getContext();
        } catch {
            await client.auth.signOut();
            throw new Error("Could not load your account. Please try again.");
        }

        if (!context || !context.profile || context.profile.role !== "student") {
            await client.auth.signOut();
            throw new Error("This is not a student account. Use the teacher tab instead.");
        }

        const classId = activeClassFor(context);

        if (!classId) {
            await client.auth.signOut();
            throw new Error("This account is not enrolled in a class. Ask your teacher to add you.");
        }

        await renderAccountBars();

        return {
            ...context,
            classId
        };
    }

    async function signInTeacher({ email, password }) {
        const address = String(email || "").trim().toLowerCase();
        if (!address || !address.includes("@") || !password) {
            throw new Error("Enter the teacher email and password.");
        }

        const { data, error } = await client.auth.signInWithPassword({
            email: address,
            password
        });

        if (error || !data.user) {
            throw new Error("Teacher email or password is incorrect.");
        }

        let context;
        try {
            context = await getContext();
        } catch {
            await client.auth.signOut();
            throw new Error("Could not load the teacher account. Please try again.");
        }

        if (!context || !context.profile || context.profile.role !== "teacher") {
            await client.auth.signOut();
            throw new Error("This is not a teacher account.");
        }

        await renderAccountBars();
        return context;
    }

    async function signOut() {
        const session = await getSession();
        if (session && session.user) {
            localStorage.removeItem(ACTIVE_CLASS_PREFIX + session.user.id);
        }
        await client.auth.signOut();
        await renderAccountBars();
    }

    function redirect(url) {
        window.location.replace(url);
    }

    async function requireStudent(nextUrl) {
        await init();
        const context = await getContext();

        if (!context) {
            redirect(loginUrl({ next: nextUrl || currentPath() }));
            return null;
        }

        if (!context.profile || context.profile.role !== "student") {
            if (context.profile && context.profile.role === "teacher") {
                redirect("teacher.html");
            } else {
                await client.auth.signOut();
                redirect(loginUrl({ next: nextUrl || currentPath(), error: "account" }));
            }
            return null;
        }

        const classId = activeClassFor(context);
        if (!classId) {
            await client.auth.signOut();
            redirect(loginUrl({ next: nextUrl || currentPath(), error: "not_enrolled" }));
            return null;
        }

        return { ...context, classId };
    }

    async function requireTeacher() {
        await init();
        const context = await getContext();

        if (!context) {
            redirect(loginUrl({ next: "teacher.html", mode: "teacher" }));
            return null;
        }

        if (!context.profile || context.profile.role !== "teacher") {
            redirect("index.html");
            return null;
        }

        return context;
    }

    function appendAccountBarContent(bar, context) {
        bar.replaceChildren();

        if (!context) {
            const link = document.createElement("a");
            link.className = "account-signin";
            link.href = loginUrl({ next: currentPath() });
            link.textContent = "Sign in";
            bar.append(link);
            return;
        }

        const chip = document.createElement("span");
        chip.className = "account-chip";

        const name = document.createElement("span");
        name.textContent = context.profile ? context.profile.display_name : context.user.email;
        chip.append(name);

        const role = document.createElement("span");
        role.className = "account-role";
        role.textContent = context.profile ? context.profile.role : "account";
        chip.append(role);

        bar.append(chip);

        if (context.profile && context.profile.role === "teacher") {
            const dashboard = document.createElement("a");
            dashboard.className = "account-link";
            dashboard.href = "teacher.html";
            dashboard.textContent = "Dashboard";
            bar.append(dashboard);
        }

        const signOutButton = document.createElement("button");
        signOutButton.type = "button";
        signOutButton.className = "account-action";
        signOutButton.textContent = "Sign out";
        signOutButton.addEventListener("click", () => {
            signOut().catch((error) => console.error(error));
        });
        bar.append(signOutButton);
    }

    async function renderAccountBars() {
        const bars = document.querySelectorAll("[data-account-bar]");
        if (!bars.length) return;

        let context = null;
        try {
            context = await getContext();
        } catch {
            context = null;
        }

        bars.forEach((bar) => appendAccountBarContent(bar, context));
    }

    function init() {
        if (initPromise) return initPromise;

        initPromise = (async () => {
            await renderAccountBars();
            client.auth.onAuthStateChange(() => {
                renderAccountBars().catch((error) => console.error(error));
            });
        })();

        return initPromise;
    }

    window.ConceptCheckAuth = {
        client,
        init,
        getSession,
        getContext,
        signInStudent,
        signInTeacher,
        signOut,
        requireStudent,
        requireTeacher,
        activeClassFor,
        studentEmail,
        normalizeUsername,
        safeNext,
        loginUrl,
        renderAccountBars
    };
})();
