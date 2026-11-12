(function () {
    "use strict";

    const auth = window.ConceptCheckAuth;
    const content = document.getElementById("progress-content");
    const subtitle = document.getElementById("progress-subtitle");

    if (!auth || !content) return;

    let refreshToken = 0;

    function formatDate(value) {
        if (!value) return "No attempts yet";
        try {
            return new Intl.DateTimeFormat("en-HK", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }).format(new Date(value));
        } catch {
            return "Recently";
        }
    }

    function showMessage(message, withLink) {
        content.replaceChildren();
        const box = document.createElement("div");
        box.className = "progress-empty";

        const text = document.createElement("span");
        text.textContent = message;
        box.append(text);

        if (withLink) {
            const link = document.createElement("a");
            link.href = auth.loginUrl({ next: window.location.pathname + window.location.search });
            link.textContent = "Sign in";
            box.append(link);
        }

        content.append(box);
        subtitle.textContent = "Only account-synced attempts are shown here.";
    }

    function topicCard(topic, label, best, latest, attempts, lastAt) {
        const card = document.createElement("article");
        card.className = "progress-card" + (topic === "force" ? " force" : "");

        const head = document.createElement("div");
        head.className = "progress-card-head";

        const title = document.createElement("strong");
        title.textContent = label;

        const bestWrap = document.createElement("span");
        bestWrap.className = "progress-best";
        bestWrap.textContent = best === null || best === undefined ? "—" : best + "/10";
        const bestSmall = document.createElement("small");
        bestSmall.textContent = " best";
        bestWrap.append(bestSmall);

        head.append(title, bestWrap);

        const meta = document.createElement("div");
        meta.className = "progress-meta";
        const latestText = latest === null || latest === undefined ? "—" : latest + "/10";
        const attemptText = (attempts || 0) + (attempts === 1 ? " attempt" : " attempts");
        const latestSpan = document.createElement("span");
        latestSpan.textContent = "Latest: " + latestText;
        const attemptsSpan = document.createElement("span");
        attemptsSpan.textContent = attemptText;
        meta.append(latestSpan, attemptsSpan);

        const date = document.createElement("div");
        date.className = "progress-meta";
        const dateSpan = document.createElement("span");
        dateSpan.textContent = lastAt ? "Last: " + formatDate(lastAt) : "Not attempted yet";
        date.append(dateSpan);

        card.append(head, meta, date);
        return card;
    }

    async function refresh() {
        const token = ++refreshToken;
        subtitle.textContent = "Checking your account progress...";
        content.innerHTML = '<p class="progress-loading">Checking your account progress...</p>';

        try {
            await auth.init();
            const context = await auth.getContext();

            if (token !== refreshToken) return;

            if (!context || !context.profile) {
                showMessage("Sign in to save quiz results and see your best scores.", true);
                return;
            }

            if (context.profile.role === "teacher") {
                subtitle.textContent = "Teacher accounts use the class dashboard.";
                content.replaceChildren();
                const box = document.createElement("div");
                box.className = "progress-empty";
                const text = document.createElement("span");
                text.textContent = "Open the teacher dashboard to view class progress.";
                const link = document.createElement("a");
                link.href = "teacher.html";
                link.textContent = "Open dashboard";
                box.append(text, link);
                content.append(box);
                return;
            }

            const activeClassId = auth.activeClassFor(context);
            const { data, error } = await auth.client
                .from("concept_check_student_progress")
                .select("*")
                .eq("user_id", context.user.id);

            if (token !== refreshToken) return;

            if (error) {
                showMessage("Could not load saved progress right now.", false);
                return;
            }

            const rows = (data || []).filter((row) => !activeClassId || row.class_id === activeClassId);
            const row = rows[0];

            if (!row) {
                showMessage("No saved progress yet. Sign in and complete a quiz to start tracking your scores.", false);
                return;
            }

            subtitle.textContent = (row.class_name ? row.class_name + " · " : "") +
                "Only account-synced attempts are shown here.";

            const grid = document.createElement("div");
            grid.className = "progress-grid";
            grid.append(
                topicCard(
                    "kinematics",
                    "Kinematics",
                    row.kinematics_best,
                    row.kinematics_latest,
                    row.kinematics_attempts,
                    row.kinematics_last_at
                ),
                topicCard(
                    "force",
                    "Force and Motion",
                    row.force_best,
                    row.force_latest,
                    row.force_attempts,
                    row.force_last_at
                )
            );

            content.replaceChildren(grid);
        } catch (error) {
            if (token !== refreshToken) return;
            showMessage("Could not check your account progress. Please sign in again.", true);
        }
    }

    auth.init().then(refresh).catch(() => {
        showMessage("Sign in to save quiz results and see your best scores.", true);
    });

    auth.client.auth.onAuthStateChange(() => {
        setTimeout(refresh, 0);
    });
})();
