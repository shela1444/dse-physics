(function () {
    "use strict";

    const auth = window.ConceptCheckAuth;
    if (!auth) return;

    const els = {
        loading: document.getElementById("teacher-loading"),
        content: document.getElementById("teacher-content"),
        classSelect: document.getElementById("class-select"),
        classCodeWrap: document.getElementById("class-code-wrap"),
        classCode: document.getElementById("class-code"),
        copyCode: document.getElementById("copy-code-button"),
        createClassForm: document.getElementById("create-class-form"),
        createClassButton: document.getElementById("create-class-button"),
        importForm: document.getElementById("import-form"),
        csvFile: document.getElementById("csv-file"),
        importPreview: document.getElementById("import-preview"),
        importButton: document.getElementById("import-button"),
        importResults: document.getElementById("import-results"),
        resetForm: document.getElementById("reset-password-form"),
        resetStudent: document.getElementById("reset-student"),
        resetPassword: document.getElementById("reset-password"),
        resetButton: document.getElementById("reset-password-button"),
        resetStatus: document.getElementById("reset-status"),
        summary: document.getElementById("class-summary"),
        progressEmpty: document.getElementById("progress-empty"),
        progressContainer: document.getElementById("progress-table-container")
    };

    let classes = [];
    let selectedClassId = null;
    let progressRows = [];
    let pendingRows = [];
    let progressRequest = 0;

    function formatDate(value) {
        if (!value) return "—";
        try {
            return new Intl.DateTimeFormat("en-HK", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }).format(new Date(value));
        } catch {
            return "—";
        }
    }

    async function callAdmin(body) {
        const { data, error } = await auth.client.functions.invoke("concept-check-admin", { body });
        if (error) {
            let message = error.message || "Request failed.";
            try {
                if (error.context && typeof error.context.json === "function") {
                    const detail = await error.context.json();
                    if (detail && detail.error) message = detail.error;
                }
            } catch {
                // Keep the original error message.
            }
            throw new Error(message);
        }

        if (data && data.error) throw new Error(data.error);
        return data;
    }

    function setButton(button, loading, label) {
        button.disabled = loading;
        button.textContent = loading ? "Working..." : label;
    }

    function currentClass() {
        return classes.find((item) => item.id === selectedClassId) || null;
    }

    function renderClassOptions(preferredId) {
        els.classSelect.replaceChildren();

        if (!classes.length) {
            const option = document.createElement("option");
            option.value = "";
            option.textContent = "No classes yet";
            els.classSelect.append(option);
            els.classSelect.disabled = true;
            selectedClassId = null;
            updateSelectedClass();
            return;
        }

        els.classSelect.disabled = false;
        classes.forEach((item) => {
            const option = document.createElement("option");
            option.value = item.id;
            option.textContent = item.name;
            els.classSelect.append(option);
        });

        const preferred = classes.find((item) => item.id === preferredId)
            || classes.find((item) => item.id === selectedClassId)
            || classes[0];

        selectedClassId = preferred.id;
        els.classSelect.value = selectedClassId;
        updateSelectedClass();
    }

    function updateSelectedClass() {
        const selected = currentClass();
        els.classCodeWrap.hidden = !selected;

        if (!selected) {
            els.classCode.textContent = "—";
            els.importButton.disabled = true;
            els.resetButton.disabled = true;
            els.resetStudent.replaceChildren();
            els.summary.replaceChildren();
            renderProgressEmpty("Create a class to start adding students.");
            return;
        }

        els.classCode.textContent = selected.code;
        els.importButton.disabled = pendingRows.length === 0;
        els.resetButton.disabled = true;
        els.resetStudent.replaceChildren();
        loadProgress();
    }

    async function loadClasses(preferredId) {
        const { data, error } = await auth.client
            .from("concept_check_classes")
            .select("id, name, code, created_at")
            .order("created_at", { ascending: true });

        if (error) throw error;
        classes = data || [];
        renderClassOptions(preferredId);
    }

    function renderProgressEmpty(message) {
        progressRows = [];
        els.progressContainer.replaceChildren();
        const empty = document.createElement("p");
        empty.className = "teacher-empty";
        empty.textContent = message;
        els.progressContainer.append(empty);
        els.resetStudent.replaceChildren();
        els.resetButton.disabled = true;
        els.summary.replaceChildren();
    }

    function topicCell(row, prefix) {
        const attempts = row[prefix + "_attempts"] || 0;
        if (!attempts) return "—";
        const best = row[prefix + "_best"];
        const latest = row[prefix + "_latest"];
        return "Best " + (best === null ? "—" : best + "/10") +
            " · Latest " + (latest === null ? "—" : latest + "/10") +
            " · " + attempts + (attempts === 1 ? " attempt" : " attempts");
    }

    function renderProgressTable() {
        els.progressContainer.replaceChildren();
        els.resetStudent.replaceChildren();

        if (!progressRows.length) {
            const empty = document.createElement("p");
            empty.className = "teacher-empty";
            empty.textContent = "No students in this class yet. Import a CSV to add them.";
            els.progressContainer.append(empty);
            els.summary.replaceChildren();
            els.resetButton.disabled = true;
            return;
        }

        const tableWrap = document.createElement("div");
        tableWrap.className = "table-wrap";
        const table = document.createElement("table");
        table.className = "progress-table";

        const thead = document.createElement("thead");
        const headRow = document.createElement("tr");
        ["Student", "Username", "Kinematics", "Force and Motion", "Last active"].forEach((label) => {
            const th = document.createElement("th");
            th.textContent = label;
            headRow.append(th);
        });
        thead.append(headRow);

        const tbody = document.createElement("tbody");
        progressRows.forEach((row) => {
            const tr = document.createElement("tr");
            const name = document.createElement("td");
            name.textContent = row.display_name;
            const username = document.createElement("td");
            username.textContent = row.username;
            username.className = "muted";
            const kinematics = document.createElement("td");
            kinematics.textContent = topicCell(row, "kinematics");
            const force = document.createElement("td");
            force.textContent = topicCell(row, "force");
            const last = document.createElement("td");
            last.textContent = formatDate(row.last_attempt_at);
            last.className = "muted";
            tr.append(name, username, kinematics, force, last);
            tbody.append(tr);
        });

        table.append(thead, tbody);
        tableWrap.append(table);
        els.progressContainer.append(tableWrap);

        const totalAttempts = progressRows.reduce((sum, row) => sum + (row.total_attempts || 0), 0);
        const kinematicsScores = progressRows
            .map((row) => row.kinematics_best)
            .filter((score) => score !== null && score !== undefined);
        const forceScores = progressRows
            .map((row) => row.force_best)
            .filter((score) => score !== null && score !== undefined);
        const average = (scores) => scores.length
            ? (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1)
            : "—";

        els.summary.replaceChildren();
        [
            progressRows.length + " students",
            totalAttempts + " attempts",
            "Kinematics avg best " + average(kinematicsScores) + "/10",
            "Force avg best " + average(forceScores) + "/10"
        ].forEach((text) => {
            const span = document.createElement("span");
            span.textContent = text;
            els.summary.append(span);
        });

        progressRows.forEach((row) => {
            const option = document.createElement("option");
            option.value = row.user_id;
            option.textContent = row.display_name + " (" + row.username + ")";
            els.resetStudent.append(option);
        });

        els.resetStudent.disabled = false;
        els.resetButton.disabled = false;
    }

    async function loadProgress() {
        const classId = selectedClassId;
        if (!classId) {
            renderProgressEmpty("Select a class to see student progress.");
            return;
        }

        const token = ++progressRequest;
        els.progressContainer.replaceChildren();
        const loading = document.createElement("p");
        loading.className = "teacher-empty";
        loading.textContent = "Loading class progress...";
        els.progressContainer.append(loading);

        const { data, error } = await auth.client
            .from("concept_check_student_progress")
            .select("*")
            .eq("class_id", classId)
            .order("display_name", { ascending: true });

        if (token !== progressRequest) return;
        if (error) {
            renderProgressEmpty("Could not load class progress: " + error.message);
            return;
        }

        progressRows = data || [];
        renderProgressTable();
    }

    function parseCsv(text) {
        const rows = [];
        let row = [];
        let field = "";
        let quoted = false;
        const source = String(text || "").replace(/^\uFEFF/, "");

        for (let i = 0; i < source.length; i += 1) {
            const char = source[i];

            if (quoted) {
                if (char === '"') {
                    if (source[i + 1] === '"') {
                        field += '"';
                        i += 1;
                    } else {
                        quoted = false;
                    }
                } else {
                    field += char;
                }
                continue;
            }

            if (char === '"') {
                quoted = true;
            } else if (char === ",") {
                row.push(field);
                field = "";
            } else if (char === "\n") {
                row.push(field);
                rows.push(row);
                row = [];
                field = "";
            } else if (char === "\r") {
                if (source[i + 1] === "\n") i += 1;
                row.push(field);
                rows.push(row);
                row = [];
                field = "";
            } else {
                field += char;
            }
        }

        if (field !== "" || row.length) {
            row.push(field);
            rows.push(row);
        }

        return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
    }

    function validateCsv(text) {
        const rows = parseCsv(text);
        if (rows.length < 2) {
            return { rows: [], error: "The CSV must contain a header row and at least one student." };
        }

        const headers = rows[0].map((header) => header.trim().toLowerCase().replace(/\s+/g, "_"));
        const nameIndex = headers.indexOf("display_name");
        const usernameIndex = headers.indexOf("username");
        const passwordIndex = headers.indexOf("default_password");

        if (nameIndex < 0 || usernameIndex < 0 || passwordIndex < 0) {
            return {
                rows: [],
                error: "CSV headers must include display_name, username, and default_password."
            };
        }

        const students = [];
        const errors = [];
        const seen = new Set();

        rows.slice(1).forEach((cells, index) => {
            const rowNumber = index + 2;
            const displayName = (cells[nameIndex] || "").trim();
            const username = (cells[usernameIndex] || "").trim().toLowerCase();
            const password = cells[passwordIndex] || "";

            if (!displayName) {
                errors.push("Row " + rowNumber + ": display name is empty.");
                return;
            }

            if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) {
                errors.push("Row " + rowNumber + ": invalid username.");
                return;
            }

            if (seen.has(username)) {
                errors.push("Row " + rowNumber + ": duplicate username " + username + ".");
                return;
            }

            if (password.length < 8 || password.length > 128) {
                errors.push("Row " + rowNumber + ": password must be 8-128 characters.");
                return;
            }

            seen.add(username);
            students.push({
                display_name: displayName,
                username,
                password
            });
        });

        if (errors.length) {
            return { rows: [], error: errors.slice(0, 5).join(" ") };
        }

        return { rows: students, error: "" };
    }

    async function handleCsvFile() {
        pendingRows = [];
        els.importResults.replaceChildren();
        els.importButton.disabled = true;

        const file = els.csvFile.files && els.csvFile.files[0];
        if (!file) {
            els.importPreview.textContent = "Choose a class and CSV file first.";
            return;
        }

        if (!selectedClassId) {
            els.importPreview.textContent = "Create or select a class before importing students.";
            return;
        }

        try {
            const text = await file.text();
            const result = validateCsv(text);
            if (result.error) {
                els.importPreview.textContent = result.error;
                return;
            }

            pendingRows = result.rows;
            const count = pendingRows.length;
            els.importPreview.textContent = count + (count === 1 ? " student ready" : " students ready") +
                " for import. Passwords are not displayed.";
            els.importButton.disabled = false;
        } catch {
            els.importPreview.textContent = "Could not read the CSV file.";
        }
    }

    function renderImportResults(data) {
        els.importResults.replaceChildren();
        const results = Array.isArray(data && data.results) ? data.results : [];
        results.forEach((result) => {
            const line = document.createElement("div");
            line.className = result.success ? "ok" : "bad";
            line.textContent = (result.success ? "Created " : "Failed ") +
                (result.display_name ? result.display_name + " (" : "") +
                result.username +
                (result.display_name ? ")" : "") +
                (result.error ? ": " + result.error : "");
            els.importResults.append(line);
        });
    }

    els.classSelect.addEventListener("change", () => {
        selectedClassId = els.classSelect.value || null;
        pendingRows = [];
        els.csvFile.value = "";
        els.importResults.replaceChildren();
        els.importPreview.textContent = "Choose a CSV file for this class.";
        updateSelectedClass();
    });

    els.copyCode.addEventListener("click", async () => {
        const selected = currentClass();
        if (!selected) return;
        try {
            await navigator.clipboard.writeText(selected.code);
            els.copyCode.textContent = "Copied";
            setTimeout(() => {
                els.copyCode.textContent = "Copy";
            }, 1400);
        } catch {
            els.copyCode.textContent = "Select";
        }
    });

    els.createClassForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const nameInput = document.getElementById("class-name");
        const name = nameInput.value.trim();
        if (!name) {
            nameInput.focus();
            return;
        }

        setButton(els.createClassButton, true, "Create class");
        try {
            const data = await callAdmin({ action: "create_class", name });
            nameInput.value = "";
            await loadClasses(data.class && data.class.id);
        } catch (error) {
            alert(error.message || "Could not create the class.");
        } finally {
            setButton(els.createClassButton, false, "Create class");
        }
    });

    els.csvFile.addEventListener("change", handleCsvFile);

    els.importForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!selectedClassId || !pendingRows.length) return;

        setButton(els.importButton, true, "Import students");
        els.importPreview.textContent = "Creating " + pendingRows.length + " student accounts...";
        const rows = pendingRows.slice();

        try {
            const data = await callAdmin({
                action: "bulk_create_students",
                class_id: selectedClassId,
                students: rows
            });
            renderImportResults(data);
            els.importPreview.textContent = "Import finished: " +
                (data.created || 0) + " created, " +
                (data.failed || 0) + " failed. Upload another CSV to add more students.";
            pendingRows = [];
            els.csvFile.value = "";
            els.importButton.disabled = true;
            await loadProgress();
        } catch (error) {
            els.importPreview.textContent = error.message || "Could not import students.";
            els.importButton.disabled = false;
        } finally {
            setButton(els.importButton, false, "Import students");
            els.importButton.disabled = pendingRows.length === 0;
        }
    });

    els.resetForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!selectedClassId || !els.resetStudent.value) return;

        setButton(els.resetButton, true, "Reset password");
        els.resetStatus.textContent = "Resetting password...";

        try {
            await callAdmin({
                action: "reset_password",
                class_id: selectedClassId,
                student_user_id: els.resetStudent.value,
                password: els.resetPassword.value
            });
            els.resetPassword.value = "";
            els.resetStatus.textContent = "Password reset for the selected student.";
        } catch (error) {
            els.resetStatus.textContent = error.message || "Could not reset the password.";
        } finally {
            setButton(els.resetButton, false, "Reset password");
            els.resetButton.disabled = !els.resetStudent.value;
        }
    });

    (async () => {
        try {
            const context = await auth.requireTeacher();
            if (!context) return;

            els.loading.hidden = true;
            els.content.hidden = false;
            await loadClasses();
        } catch (error) {
            els.loading.textContent = error.message || "Could not load the teacher dashboard.";
        }
    })();
})();
