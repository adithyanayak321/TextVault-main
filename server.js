
const express = require("express");
const mongoose = require("mongoose");
const { nanoid } = require("nanoid");
const Document = require("./models/document");
const URL = require("./models/urlShorten");
const validURL = require("valid-url");
const app = express();
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
var longURL;
var error = "Server Error!! Please Try Again Later.";

mongoose.connect("mongodb+srv://adithyanayak:adithyanayak321@cluster0.buuohlf.mongodb.net/wastebin", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;

db.on("error", (error) => {
  console.error("Error connecting to MongoDB:", error);
  process.exit(1);
});

db.once("open", () => {
  console.log("Connected to MongoDB Atlas");

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
});

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/new", (req, res) => {
  res.render("new");
});

app.post("/save", async (req, res) => {
  const { value, customExpiry } = req.body;
try {
  console.log("Saving document:", { value, customExpiry });

  let expiryTimestamp = null;
  if (customExpiry) {
    const currentTimestamp = new Date();
    expiryTimestamp = new Date(
      currentTimestamp.getTime() + customExpiry * 60000
    );

    // Convert to local time zone (Asia/Calcutta in this case)
    expiryTimestamp = new Date(expiryTimestamp.toLocaleString('en-US', { timeZone: 'Asia/Calcutta' }));
  }

  const document = await Document.create({ value, expiryTimestamp });
  console.log("Document saved successfully:", document);


  res.redirect(`/documents/${document.id}`);
} catch (e) {
  console.error("Error saving document:", e);
  res.render("new", { value });
}
});

app.post("/api/generate-url", async (req, res) => {
  console.log("Received request body:", req.body);

  try {
    if (!req.body || !req.body.value) {
      throw new Error("Value is missing in the request body");
    }

    const document = await Document.create({ value: req.body.value });
    const normalURL = `/documents/${document.id}`;
    const fullURL = `${BASE_URL}${normalURL}`;

    res.json({ id: document.id, fullURL });
  } catch (e) {
    console.error("Error creating document:", e.message);
    res.status(500).json({ error: "An error occurred. Please try again." });
  }
});

app.get("/:id/duplicate", async (req, res) => {
  const id = req.params.id;
  try {
    const document = await Document.findById(id);
    res.render("new", { value: document.value });
  } catch (e) {
    res.redirect(`/${id}`);
  }
});

app.get("/url-short", (req, res) => {
  res.render("url-short", { error: "", newURL: {} });
});
app.post("/url-short", async (req, res) => {
  try {
    const customAlias = req.body.customAlias || nanoid(11);
    longURL = req.body.longURL;
    const shortURL = BASE_URL + "/" + customAlias;

    console.log("Received longURL:", longURL);
    console.log("Received customAlias:", customAlias);
    console.log("Generated shortID:", customAlias);

    const existingURL = await URL.findOne({ longURL: longURL });

    if (!existingURL) {
      const newURL = new URL({
        longURL: longURL,
        shortURL: shortURL,
        shortID: customAlias,
      });

      await newURL.save();
      console.log("New URL saved:", newURL);
      displayShortURL(req, res, newURL);
    } else {
      console.log("URL already exists in the database:", existingURL);

      // Use existing shortID consistently
      existingURL.shortID = customAlias;
      await existingURL.save();

      displayShortURL(req, res, existingURL);
    }
  } catch (error) {
    console.error("Error in /url-short:", error);
    res.render("index", {
      error: "An error occurred. Please try again.",
      newURL: {},
    });
  }
});
app.get("/:param", async (req, res) => {
  const param = req.params.param;

  try {
    const document = await Document.findOne({ customAlias: param });

    if (document) {
      res.redirect(document.longURL);
    } else {
      const result = await URL.findOne({ shortID: param });

      if (result == null) {
        return res.sendStatus(404);
      }

      res.redirect(result.longURL);
    }
  } catch (error) {
    console.error(error);
    return res.sendStatus(500);
  }
});


async function displayShortURL(req, res, result) {
  try {
    const existingURL = await URL.findOne({ shortID: result.shortID });

    if (existingURL) {
      res.render("url-short", { error: "", newURL: existingURL });
    } else {
      console.error(
        "Error finding short URL in displayShortURL:",
        result.shortID
      );
      res.render("url-short", {
        error: "An error occurred. Please try again.",
        newURL: {},
      });
    }
  } catch (error) {
    console.error("Error in displayShortURL:", error);
    res.render("url-short", {
      error: "An error occurred. Please try again.",
      newURL: {},
    });
  }
}


app.use((req, res, next) => {
  if (req.url === "/favicon.ico") {
    res.status(204).end();
  } else {
    next();
  }
});
app.get("/documents/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const document = await Document.findById(id);

    if (document) {
      document.mainURLAccessCount += 1;
      await document.save();

      const currentTimestamp = new Date();
      if (
        document.expiryTimestamp &&
        currentTimestamp > document.expiryTimestamp
      ) {
        res.redirect("/");
      } else {
        res.render("display", {
          code: document.value,
          id,
          expiryTimestamp: document.expiryTimestamp,
          mainURLAccessCount: document.mainURLAccessCount,
        });
      }
    } else {
      res.redirect("/");
    }
  } catch (e) {
    console.error(e);
    res.redirect("/");
  }
});

app.get("/shorten-url/:id", async (req, res) => {
  const id = req.params.id;
  try {
    if (mongoose.Types.ObjectId.isValid(id)) {
      console.log("Valid ObjectId:", id);

      const document = await Document.findById(id);

      if (document) {
        
        const longURL = req.headers.referer || "";
        console.log(longURL);

        document.longURL = longURL;
        await document.save();

        const shortURL = document.customAlias;

        res.render("paste-url", {
          longURL,
          id,
          shortURL,
          error: "",
        });
      } else {
        res.redirect("/");
      }
    } else {
      console.log("Invalid ObjectId:", id);
      res.render("paste-url", {
        error: "Invalid short URL",
        id,
        shortURL: "",
      });
    }
  } catch (e) {
    console.error(e);
    res.redirect("/");
  }
});

app.post("/shorten-url/:id", async (req, res) => {
  const id = req.params.id;
  const customAlias = req.body.customAlias;
  try {
    const document = await Document.findById(id);

    if (document) {
      if (customAlias) {
        const existingDocument = await Document.findOne({ customAlias });
        if (existingDocument) {
          return res.render("paste-url", {
            longURL: document.longURL,
            error: "Custom alias already in use. Please choose another one.",
            id,
            shortURL: "",
          });
        }
        document.customAlias = customAlias;
      }

      await document.save();

      res.render("paste-url", {
        longURL: document.longURL,
        id,
        shortURL: BASE_URL + "/" + document.customAlias,
        error: "", 
      });
    } else {
      res.redirect("/");
    }
  } catch (e) {
    console.error(e);
    res.render("paste-url", {
      error: "An error occurred. Please try again.",
      id,
      shortURL: "",
    });
  }
});





