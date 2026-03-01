require("dotenv").config();
const express = require("express");
const cors = require("cors");

const { initializeDatabase } = require("./config/db");
const SalesAgent = require("./models/SalesAgent");
const Lead = require("./models/Lead");
const Comment = require("./models/Comment");

const app = express();

const corsOptions = {
  origin: "*",
  credentials: true,
};

const PORT = process.env.PORT || 3000;

app.use(cors(corsOptions));
app.use(express.json());

initializeDatabase();

app.get("/", (req, res) => {
  res.send("API is running...");
});

app.get("/agents", async (req, res) => {
  try {
    const agents = await SalesAgent.find();
    res.status(200).json(agents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function createSampleData() {
  try {
    const lead = await Lead.create({
      name: "Acme Corp",
      source: "Referral",
      salesAgent: "699670d3a4348c878c2c468a", 
      status: "New",
      tags: ["High Value", "Follow-up"],
      timeToClose: 30,
      priority: "High"
    });

    console.log("", lead);
    return lead;
  } catch (error) {
    console.error("Er  e", error);
    throw error;
  }
}

app.get("/leads", async (req, res) => {
  try {
    const { salesAgent, status, tags, source, page = 1, limit = 10 } = req.query;

    const filter = {};

    if (salesAgent) {
      if (!mongoose.Types.ObjectId.isValid(salesAgent)) {
        return res.status(400).json({
          error: "Invalid salesAgent ID",
        });
      }
      filter.salesAgent = salesAgent;
    }

    const ALLOWED_STATUS = [
      "New",
      "Contacted",
      "Qualified",
      "Proposal Sent",
      "Closed",
    ];

    if (status) {
      if (!ALLOWED_STATUS.includes(status)) {
        return res.status(400).json({
          error: `Invalid status. Allowed: ${ALLOWED_STATUS.join(", ")}`,
        });
      }
      filter.status = status;
    }

    if (source) {
      filter.source = source.trim();
    }

    if (tags) {
      const tagsArray = Array.isArray(tags)
        ? tags
        : tags.split(",").map((tag) => tag.trim());

      filter.tags = { $in: tagsArray };
    }

    const pageNumber = Math.max(Number(page), 1);
    const pageLimit = Math.min(Number(limit), 50);
    const skip = (pageNumber - 1) * pageLimit;

    const [leads, total] = await Promise.all([
      Lead.find(filter)
        .populate("salesAgent", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageLimit)
        .lean(),
      Lead.countDocuments(filter),
    ]);

    res.status(200).json({
      total,
      page: pageNumber,
      limit: pageLimit,
      totalPages: Math.ceil(total / pageLimit),
      data: leads,
    });
  } catch (error) {
    console.error("GET /leads error:", error);
    res.status(500).json({
      error: "Failed to fetch leads",
    });
  }
});

app.get("/leads/:id/comments", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid lead ID" });
    }

    const leadExists = await Lead.exists({ _id: id });
    if (!leadExists) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const comments = await Comment.find({ lead: id })
      .populate("author", "name email")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json(comments);
  } catch (error) {
    console.error("GET /leads/:id/comments error:", error);
    res.status(500).json({ error: "Failed to fetch comments." });
  }
});

app.post("/leads", async (req, res) => {
  try {
    const lead = await Lead.create(req.body);
    res.status(201).json(lead);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/leads/:id/comments", async (req, res) => {
  try {
    const comment = await Comment.create({
      ...req.body,
      lead: req.params.id
    });

    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/agents", async (req, res) => {
  try {
    const { name, email } = req.body;
    if(!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }
    const existingAgent = await SalesAgent.findOne({ email: email.toLowerCase(), });
    if(existingAgent) {
      return res.status(400).json({ error: "Email already exists" });
    }

     const agent = await SalesAgent.create({
      name: name.trim(),
      email: email.toLowerCase(),
    });

    res.status(201).json(agent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/leads/:id", async (req, res) => {
  try {
    const lead = await Lead.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.status(200).json(lead);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch("/leads/:id", async (req, res) => {
  try {
    const lead = await Lead.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.status(200).json(lead);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/leads/:id", async (req, res) => {
  try {
    await Lead.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Lead deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
