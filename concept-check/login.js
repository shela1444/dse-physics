(function () {
    "use strict";

    const auth = window.ConceptCheckAuth;
    if (!auth) return;

    const params = new URLSearchParams(window.location.search);
    const requestedRole = params.get("role") === "teacher" ? "teacher" : "student";
    const nextCandidate = params.get("next") || "";
    const safeNext = nextCandidate && !nextCandidate.includes("login.html")
        ? auth.safeNext(nextCandidate, "index.html")
        : "index.html";

    const els = {
        studentTab: document.getElementById("student-tab"),
        teacherTab: document.getElementById("teacher-tab"),
        studentPanel: document.getElementById("student-panel"),
        teacherPanel: document.getElementById("teacher-panel"),
        studentForm: document.getElementById("student-form"),
        teacherForm: document.getElementById("teacher-form"),
        studentSubmit: document.getElementById("student-submit"),
        teacherSubmit: document.getElementById("teacher-submit"),
        error: document.getElementById("auth-error")
    };

    const errorMessages = {
        not_enrolled: "Your account is not enrolled in a class. Ask your teacher to add you to the class.",
        account: "Your account is not fully set up. Ask your teacher to check it.",
        teacher: "Use the teacher tab for a teacher account."
    };

    function setTab(mode, focusField = false) {
        const isTeacher = mode === "teacher";
        els.studentTab.setAttribute("aria-selected", String(!isTeacher));
        els.teacherTab.setAttribute("aria-selected", String(isTeacher));
        els.studentPanel.hidden = isTeacher;
        els.teacherPanel.hidden = !isTeacher;

        if (!focusField) return;
        if (isTeacher) {
            document.getElementById("teacher-username").focus();
        } else {
            document.getElementById("class-code").focus();
        }
    }

    function showError(message) {
        els.error.textContent = message;
        els.error.hidden = !message;
    }

    function setLoading(button, loading, label) {
        button.disabled = loading;
        button.textContent = loading ? "Signing in..." : label;
    }

    function redirectAfterStudentLogin() {
        window.location.replace(safeNext || "index.html");
    }

    els.studentTab.addEventListener("click", () => setTab("student", true));
    els.teacherTab.addEventListener("click", () => setTab("teacher", true));

    els.studentForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        showError("");
        const classCode = document.getElementById("class-code").value;
        const username = document.getElementById("student-username").value;
        const password = document.getElementById("student-password").value;

        setLoading(els.studentSubmit, true, "Sign in as student");
        try {
            await auth.signInStudent({ classCode, username, password });
            redirectAfterStudentLogin();
        } catch (error) {
            showError(error.message || "Could not sign in. Check your details and try again.");
            setLoading(els.studentSubmit, false, "Sign in as student");
        }
    });

    els.teacherForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        showError("");
        const username = document.getElementById("teacher-username").value;
        const password = document.getElementById("teacher-password").value;

        setLoading(els.teacherSubmit, true, "Sign in as teacher");
        try {
            await auth.signInTeacher({ username, password });
            window.location.replace("teacher.html");
        } catch (error) {
            showError(error.message || "Could not sign in. Check your details and try again.");
            setLoading(els.teacherSubmit, false, "Sign in as teacher");
        }
    });

    const queryError = params.get("error");
    if (queryError && errorMessages[queryError]) {
        showError(errorMessages[queryError]);
    }

    setTab(requestedRole);

    (async () => {
        try {
            await auth.init();
            const context = await auth.getContext();
            if (!context || !context.profile) return;

            if (context.profile.role === "teacher") {
                window.location.replace("teacher.html");
            } else if (context.profile.role === "student") {
                window.location.replace(safeNext || "index.html");
            }
        } catch {
            // Keep the form available if session restoration fails.
        }
    })();
})();
