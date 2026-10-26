const requestForm = document.getElementById("requestForm");
const requestMessage = document.getElementById("requestMessage");

const trackForm = document.getElementById("trackForm");
const trackingResult = document.getElementById("trackingResult");

const organizerLogin = document.getElementById("organizerLogin");
const organizerMessage = document.getElementById("organizerMessage");

const dashboard = document.getElementById("dashboard");
const requestList = document.getElementById("requestList");

let organizerKey = "";

async function api(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Something went wrong.");
    }

    return data;
}

function showMessage(element, message, isError = false) {
    element.textContent = message;
    element.style.color = isError ? "#b42318" : "#16734b";
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

// 1. Submit pickup request
requestForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const payload = {
        name: document.getElementById("name").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        address: document.getElementById("address").value.trim(),
        area: document.getElementById("area").value.trim(),
        wasteType: document.getElementById("wasteType").value,
        details: document.getElementById("details").value.trim()
    };

    try {
        const data = await api("/api/requests", {
            method: "POST",
            body: JSON.stringify(payload)
        });

        showMessage(
            requestMessage,
            `Request submitted successfully! Your tracking ID is ${data.request.id}. Please save it.`
        );

        requestForm.reset();
    } catch (error) {
        showMessage(requestMessage, error.message, true);
    }
});

// 2. Track request
trackForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const id = document.getElementById("trackingId").value.trim();

    try {
        const data = await api(
            `/api/requests/${encodeURIComponent(id)}`
        );

        const request = data.request;

        trackingResult.innerHTML = `
            <h3>Request: ${escapeHTML(request.id)}</h3>
            <p><strong>Status:</strong> ${escapeHTML(request.status)}</p>
            <p><strong>Waste Type:</strong> ${escapeHTML(request.wasteType)}</p>
            <p><strong>Area:</strong> ${escapeHTML(request.area || "Not provided")}</p>
            <p><strong>Last Updated:</strong>
                ${new Date(request.updatedAt).toLocaleString()}
            </p>
        `;
        trackingResult.style.color = "#16734b";
    } catch (error) {
        showMessage(trackingResult, error.message, true);
    }
});

// 3. Organizer login
organizerLogin.addEventListener("submit", async function (event) {
    event.preventDefault();

    organizerKey = document.getElementById("organizerKey").value;

    try {
        await api("/api/organizer/login", {
            method: "POST",
            body: JSON.stringify({ key: organizerKey })
        });

        showMessage(organizerMessage, "Organizer login successful.");
        dashboard.hidden = false;

        await loadRequests();
    } catch (error) {
        dashboard.hidden = true;
        showMessage(organizerMessage, error.message, true);
    }
});

// 4. Load all requests for organizer
async function loadRequests() {
    try {
        const data = await api("/api/organizer/requests", {
            headers: {
                "x-organizer-key": organizerKey
            }
        });

        requestList.innerHTML = "";

        if (data.requests.length === 0) {
            requestList.innerHTML = `
                <tr>
                    <td colspan="6">No pickup requests yet.</td>
                </tr>
            `;
            return;
        }

        data.requests.forEach(request => {
            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${escapeHTML(request.id)}</td>
                <td>
                    ${escapeHTML(request.name)}
                    <br>
                    <small>${escapeHTML(request.phone)}</small>
                </td>
                <td>${escapeHTML(request.address)}</td>
                <td>${escapeHTML(request.wasteType)}</td>
                <td>
                    <select class="status-select">
                        ${[
                            "Pending",
                            "Accepted",
                            "In Progress",
                            "Completed",
                            "Rejected"
                        ].map(status => `
                            <option ${request.status === status ? "selected" : ""}>
                                ${status}
                            </option>
                        `).join("")}
                    </select>
                </td>
                <td>
                    <button class="btn save-status" type="button">
                        Save
                    </button>
                </td>
            `;

            row.querySelector(".save-status").addEventListener(
                "click",
                async function () {
                    const status = row.querySelector(".status-select").value;

                    try {
                        await api(
                            `/api/organizer/requests/${encodeURIComponent(request.id)}`,
                            {
                                method: "PATCH",
                                headers: {
                                    "x-organizer-key": organizerKey
                                },
                                body: JSON.stringify({ status })
                            }
                        );

                        showMessage(
                            organizerMessage,
                            `Request ${request.id} updated to ${status}.`
                        );

                        await loadRequests();
                    } catch (error) {
                        showMessage(organizerMessage, error.message, true);
                    }
                }
            );

            requestList.appendChild(row);
        });
    } catch (error) {
        dashboard.hidden = true;
        showMessage(organizerMessage, error.message, true);
    }
}

// 5. Refresh dashboard
document.getElementById("refreshRequests").addEventListener(
    "click",
    loadRequests
);