require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { initializeDatabase } = require("./config/db");
const SalesAgent = require("./models/SalesAgent");
const Lead = require("./models/Lead");
const Comment = require("./models/Comment");
const Tag = require("./models/Tag");
const User = require("./models/User");

const app = express();

const corsOptions = {
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
};

const PORT = process.env.PORT || 3000;

const ALLOWED_STATUS = [
  "New",
  "Contacted",
  "Qualified",
  "Proposal Sent",
  "Closed",
];

const ALLOWED_SOURCES = ["Website", "Referral", "Cold Call"];
const ALLOWED_PRIORITIES = ["High", "Medium", "Low"];

app.use(cors(corsOptions));
app.use(express.json());

function validateObjectId(id, label = "ID") {
  return mongoose.Types.ObjectId.isValid(id)
    ? null
    : `${label} is invalid`;
}

function validateLeadPayload(body, isPartial = false) {
  const errors = [];
  const { name, source, salesAgent, status, tags, timeToClose, priority } = body;

  if (!isPartial || name !== undefined) {
    if (!name || !String(name).trim()) {
      errors.push("Lead name is required");
    }
  }

  if (!isPartial || source !== undefined) {
    if (!ALLOWED_SOURCES.includes(source)) {
      errors.push(`Source must be one of: ${ALLOWED_SOURCES.join(", ")}`);
    }
  }

  if (!isPartial || salesAgent !== undefined) {
    if (!salesAgent || !mongoose.Types.ObjectId.isValid(salesAgent)) {
      errors.push("Valid salesAgent ID is required");
    }
  }

  if (!isPartial || status !== undefined) {
    if (!ALLOWED_STATUS.includes(status)) {
      errors.push(`Status must be one of: ${ALLOWED_STATUS.join(", ")}`);
    }
  }

  if (!isPartial || priority !== undefined) {
    if (!ALLOWED_PRIORITIES.includes(priority)) {
      errors.push(`Priority must be one of: ${ALLOWED_PRIORITIES.join(", ")}`);
    }
  }

  if (!isPartial || timeToClose !== undefined) {
    if (
      timeToClose === "" ||
      Number.isNaN(Number(timeToClose)) ||
      Number(timeToClose) < 0
    ) {
      errors.push("timeToClose must be a valid non-negative number");
    }
  }

  if (tags !== undefined && !Array.isArray(tags)) {
    errors.push("tags must be an array");
  }

  return errors;
}

app.get("/", (req, res) => {
  res.send("API is running...");
});

app.post("/register", async(req, res) => {
  const {username, password} = req.body;
  if(!username || !password) {
    return res.status(400).json({error: "Username and password are required"});
  }
  try {
    const existingUser = await User.findOne({username});
    if(existingUser) {
      return res.status(409).json({error: "Username already exists"});
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const user = new User({username, password: hashedPassword});
    await user.save();
    const token = jwt.sign({id: user._id}, process.env.JWT_SECRET, {expiresIn: "4h"});
    res.status(201).json({message: "User registered successfully", token, username: user.username});
  } catch (error) {
    res.status(500).json({message: "Error registering user", error: error.message});
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }
  try {
    const user = await User.findOne({ username: username.toLowerCase() }).select("+password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "4h" });
    res.status(200).json({ message: "Login successful", token, username: user.username });
  } catch (error) {
    res.status(500).json({ message: "Error logging in", error: error.message });
  }
});

app.get("/agents", async (req, res) => {
  try {
    const agents = await SalesAgent.find().sort({ createdAt: -1 }).lean();
    res.status(200).json(agents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/agents", async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name?.trim() || !email?.trim()) {
      return res.status(400).json({ error: "Name and email are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingAgent = await SalesAgent.findOne({ email: normalizedEmail });
    if (existingAgent) {
      return res.status(409).json({ error: "Email already exists" });
    }

    const agent = await SalesAgent.create({
      name: name.trim(),
      email: normalizedEmail,
    });

    res.status(201).json(agent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/tags", async (req, res) => {
  try {
    const tags = await Tag.find().sort({ name: 1 }).lean();
    res.status(200).json(tags);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/tags", async (req, res) => {
  try {
    const { name } = req.body;
    const trimmedName = name?.trim();

    if (!trimmedName) {
      return res.status(400).json({ error: "Name is required" });
    }

    const existingTag = await Tag.findOne({ name: trimmedName });
    if (existingTag) {
      return res.status(409).json({ error: "Tag already exists" });
    }

    const tag = await Tag.create({ name: trimmedName });
    res.status(201).json(tag);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/leads", async (req, res) => {
  try {
    const { salesAgent, status, tags, source, page = 1, limit = 10 } = req.query;
    const filter = {};

    if (salesAgent) {
      const idError = validateObjectId(salesAgent, "salesAgent ID");
      if (idError) {
        return res.status(400).json({ error: idError });
      }
      filter.salesAgent = salesAgent;
    }

    if (status) {
      if (!ALLOWED_STATUS.includes(status)) {
        return res.status(400).json({
          error: `Invalid status. Allowed: ${ALLOWED_STATUS.join(", ")}`,
        });
      }
      filter.status = status;
    }

    if (source) {
      if (!ALLOWED_SOURCES.includes(source.trim())) {
        return res.status(400).json({
          error: `Invalid source. Allowed: ${ALLOWED_SOURCES.join(", ")}`,
        });
      }
      filter.source = source.trim();
    }

    if (tags) {
      const tagsArray = Array.isArray(tags)
        ? tags
        : String(tags)
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean);

      filter.tags = { $in: tagsArray };
    }

    const pageNumber = Math.max(Number(page) || 1, 1);
    const pageLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);
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
    res.status(500).json({ error: error.message });
  }
});

app.get("/leads/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const idError = validateObjectId(id, "Lead ID");

    if (idError) {
      return res.status(400).json({ error: idError });
    }

    const lead = await Lead.findById(id)
      .populate("salesAgent", "name email")
      .lean();

    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    res.status(200).json(lead);
  } catch (error) {
    console.error("GET /leads/:id error:", error);
    res.status(500).json({ error: "Failed to fetch lead." });
  }
});

app.post("/leads", async (req, res) => {
  try {
    const errors = validateLeadPayload(req.body);

    if (errors.length) {
      return res.status(400).json({ errors });
    }

    const agentExists = await SalesAgent.exists({ _id: req.body.salesAgent });
    if (!agentExists) {
      return res.status(404).json({ error: "Sales agent not found" });
    }

    const lead = await Lead.create({
      ...req.body,
      name: req.body.name.trim(),
      source: req.body.source.trim(),
      timeToClose: Number(req.body.timeToClose),
      tags: req.body.tags || [],
    });

    const populatedLead = await Lead.findById(lead._id)
      .populate("salesAgent", "name email")
      .lean();

    res.status(201).json(populatedLead);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch("/leads/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const idError = validateObjectId(id, "Lead ID");

    if (idError) {
      return res.status(400).json({ error: idError });
    }

    const errors = validateLeadPayload(req.body, true);
    if (errors.length) {
      return res.status(400).json({ errors });
    }

    if (req.body.salesAgent) {
      const agentExists = await SalesAgent.exists({ _id: req.body.salesAgent });
      if (!agentExists) {
        return res.status(404).json({ error: "Sales agent not found" });
      }
    }

    const updatePayload = { ...req.body };

    if (updatePayload.name !== undefined) {
      updatePayload.name = updatePayload.name.trim();
    }

    if (updatePayload.source !== undefined) {
      updatePayload.source = updatePayload.source.trim();
    }

    if (updatePayload.timeToClose !== undefined) {
      updatePayload.timeToClose = Number(updatePayload.timeToClose);
    }

    const lead = await Lead.findByIdAndUpdate(id, updatePayload, {
      new: true,
      runValidators: true,
    }).populate("salesAgent", "name email");

    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    res.status(200).json(lead);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/leads/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const idError = validateObjectId(id, "Lead ID");

    if (idError) {
      return res.status(400).json({ error: idError });
    }

    const deletedLead = await Lead.findByIdAndDelete(id);
    if (!deletedLead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    res.status(200).json({ message: "Lead deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/leads/:id/comments", async (req, res) => {
  try {
    const { id } = req.params;
    const idError = validateObjectId(id, "Lead ID");

    if (idError) {
      return res.status(400).json({ error: idError });
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

app.post("/leads/:id/comments", async (req, res) => {
  try {
    const { id } = req.params;
    const { commentText, author } = req.body;

    const idError = validateObjectId(id, "Lead ID");
    if (idError) {
      return res.status(400).json({ error: idError });
    }

    if (!commentText || !String(commentText).trim()) {
      return res.status(400).json({ error: "commentText is required" });
    }

    const leadExists = await Lead.exists({ _id: id });
    if (!leadExists) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const commentPayload = {
      lead: id,
      commentText: String(commentText).trim(),
    };

    if (author !== undefined) {
      const authorError = validateObjectId(author, "Author ID");
      if (authorError) {
        return res.status(400).json({ error: authorError });
      }
      commentPayload.author = author;
    }

    const comment = await Comment.create(commentPayload);

    const populatedComment = await Comment.findById(comment._id)
      .populate("author", "name email")
      .lean();

    res.status(201).json(populatedComment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/report/last-week", async (req, res) => {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const leads = await Lead.find({
      status: "Closed",
      updatedAt: { $gte: oneWeekAgo },
    })
      .populate("salesAgent", "name email")
      .sort({ updatedAt: -1 })
      .lean();

    res.status(200).json(leads);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/report/pipeline", async (req, res) => {
  try {
    const pipeline = await Lead.aggregate([
      {
        $group: {
          _id: "$status",
          totalLeads: { $sum: 1 },
        },
      },
      {
        $sort: { totalLeads: -1 },
      },
    ]);

    res.status(200).json(pipeline);
  } catch (error) {
    res.status(500).json({
      error: "Failed to generate pipeline report",
    });
  }
});

app.get("/report/closed-by-agent", async (req, res) => {
  try {
    const report = await Lead.aggregate([
      {
        $match: { status: "Closed" },
      },
      {
        $group: {
          _id: "$salesAgent",
          totalClosed: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "salesagents",
          localField: "_id",
          foreignField: "_id",
          as: "agent",
        },
      },
      {
        $unwind: {
          path: "$agent",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          salesAgentId: "$_id",
          agentName: { $ifNull: ["$agent.name", "Unassigned"] },
          totalClosed: 1,
        },
      },
      {
        $sort: { totalClosed: -1 },
      },
    ]);

    res.status(200).json(report);
  } catch (error) {
    res.status(500).json({
      error: "Failed to generate closed-by-agent report",
    });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

initializeDatabase().catch((err) => {
  console.error("Database connection failed:", err);
});

if (require.main === module) {
  // Only listen when run directly (local dev via `node index.js` / nodemon)
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

module.exports = app;
