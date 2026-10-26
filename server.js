require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;
const ORGANIZER_KEY =
    process.env.ORGANIZER_KEY || "demo-organizer-key-change-me";

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "requests.json");

app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

// Create data directory and file if they don't exist
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, "[]", "utf8");
}

function readRequests() {
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    } catch {
        return [];
    }
}

function writeRequests(requests) {
    fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(requests, null, 2),
        "utf8"
    );
}

function clean(value, maxLength = 300) {
    return String(value ?? "").trim().slice(0, maxLength);
}

// Protect organizer routes
function organizerOnly(req, res, next) {
    const key = req.get("x-organizer-key");

    if (!key || key !== ORGANIZER_KEY) {
        return res.status(401).json({
            error: "Organizer key is missing or incorrect."
        });
    }

    next();
}

// Health check
app.get("/api/health", (req, res) => {
    res.json({
        ok: true,
        message: "Waste Pickup Request Portal backend is running."
    });
});

// Create pickup request
app.post("/api/requests", (req, res) => {
    const name = clean(req.body.name, 100);
    const phone = clean(req.body.phone, 30);
    const address = clean(req.body.address, 300);
    const area = clean(req.body.area, 100);
    const wasteType = clean(req.body.wasteType, 60);
    const details = clean(req.body.details, 1000);

    if (!name || !phone || !address || !wasteType) {
        return res.status(400).json({
            error: "Name, phone, address, and waste type are required."
        });
    }

    const now = new Date().toISOString();

    const request = {
        id: "WP-" + crypto.randomBytes(3).toString("hex").toUpperCase(),
        name,
        phone,
        address,
        area,
        wasteType,
        details,
        status: "Pending",
        createdAt: now,
        updatedAt: now
    };

    const requests = readRequests();

    requests.unshift(request);
    writeRequests(requests);

    res.status(201).json({
        message: "Pickup request created successfully.",
        request
    });
});

// Track one request using its ID
app.get("/api/requests/:id", (req, res) => {
    const id = clean(req.params.id, 30).toUpperCase();

    const request = readRequests().find(
        item => item.id.toUpperCase() === id
    );

    if (!request) {
        return res.status(404).json({
            error: "No request found with that tracking ID."
        });
    }

    // Do not expose personal phone number or full address publicly.
    res.json({
        request: {
            id: request.id,
            area: request.area,
            wasteType: request.wasteType,
            status: request.status,
            createdAt: request.createdAt,
            updatedAt: request.updatedAt
        }
    });
});

// Organizer login
app.post("/api/organizer/login", (req, res) => {
    const key = clean(req.body.key, 200);

    if (!key || key !== ORGANIZER_KEY) {
        return res.status(401).json({
            error: "Incorrect organizer key."
        });
    }

    res.json({
        message: "Organizer access granted."
    });
});

// Get all requests for organizer
app.get("/api/organizer/requests", organizerOnly, (req, res) => {
    res.json({
        requests: readRequests()
    });
});

// Update request status
app.patch("/api/organizer/requests/:id", organizerOnly, (req, res) => {
    const allowedStatuses = [
        "Pending",
        "Accepted",
        "In Progress",
        "Completed",
        "Rejected"
    ];

    const status = clean(req.body.status, 40);
    const id = clean(req.params.id, 30).toUpperCase();

    if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
            error: "Invalid request status."
        });
    }

    const requests = readRequests();

    const index = requests.findIndex(
        item => item.id.toUpperCase() === id
    );

    if (index === -1) {
        return res.status(404).json({
            error: "Request not found."
        });
    }

    requests[index].status = status;
    requests[index].updatedAt = new Date().toISOString();

    writeRequests(requests);

    res.json({
        message: "Request status updated successfully.",
        request: requests[index]
    });
});

// Serve frontend
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
