if (process.env.NODE_ENV !== "production") {
	require("dotenv").config();
}

const express = require("express");
const app = express();
const bcrypt = require("bcrypt");
const passport = require("passport");
const initializePassport = require("./passport-config");
const flash = require("express-flash");
const session = require("express-session");
const methodOverride = require("method-override");

const {
	GoogleGenerativeAI,
	HarmCategory,
	HarmBlockThreshold,
} = require("@google/generative-ai");

const MODEL_NAME = "gemini-1.0-pro";
const API_KEY = process.env.GOOGLE_API_KEY; // Use your actual API key from environment variables

const users = [];

initializePassport(
	passport,
	(email) => users.find((user) => user.email === email),
	(id) => users.find((user) => user.id === id)
);

app.set("view engine", "ejs"); // Set up EJS as the template engine

app.use(express.static("public"));
app.use(express.urlencoded({ extended: false }));
app.use(flash());
app.use(
	session({
		secret: process.env.SESSION_SECRET,
		resave: false, // Do not resave session if not modified
		saveUninitialized: false,
		cookie: { maxAge: 30 * 60 * 1000 },
	})
);
app.use(passport.initialize());
app.use(passport.session());
app.use(methodOverride("_method"));

// Middleware to check session expiration
function checkSessionExpiration(req, res, next) {
	if (req.isAuthenticated() && req.session.cookie.expires < new Date()) {
		req.logout();
	}
	next();
}

// Apply the middleware to check session expiration
app.use(checkSessionExpiration);

app.get("/", checkAuthenticated, function (req, res) {
	res.render("index.ejs", { name: req.user.name });
});
// app.get("/", checkAuthenticated, function (req, res) {
// 	res.render("index.ejs", {
// 		name: req.user.name,
// 		userDiagnosis: req.session.userDiagnosis,
// 	});
// });

app.get("/login", function (req, res) {
	res.render("login.ejs");
});

app.get("/register", function (req, res) {
	res.render("register.ejs");
});

app.post(
	"/login",
	passport.authenticate("local", {
		successRedirect: "/",
		failureRedirect: "/login",
		failureFlash: true,
	})
);

app.post("/register", async (req, res) => {
	try {
		const hashedPassword = await bcrypt.hash(req.body.password, 10);
		const newUser = {
			id: Date.now().toString(),
			name: req.body.name,
			email: req.body.email,
			password: hashedPassword,
		};
		users.push(newUser);
		// console.table(newUser);
		res.redirect("/login");
	} catch (e) {
		console.log(e);
		res.redirect("/register");
	}
});

app.post("/getDiagnosis", (req, res) => {
	const userSymptoms = req.body.userSymptoms;

	async function runChat() {
		try {
			const genAI = new GoogleGenerativeAI(API_KEY);
			const model = genAI.getGenerativeModel({ model: MODEL_NAME });

			const generationConfig = {
				temperature: 0.9,
				topK: 1,
				topP: 1,
				maxOutputTokens: 2048,
			};

			const safetySettings = [
				{
					category: HarmCategory.HARM_CATEGORY_HARASSMENT,
					threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
				},
				{
					category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
					threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
				},
				{
					category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
					threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
				},
				{
					category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
					threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
				},
			];

			const chat = model.startChat({
				generationConfig,
				safetySettings,
				history: [
					{ role: "user", parts: [{ text: "Hello" }] },
					{
						role: "model",
						parts: [{ text: "Hello there! How can I assist you today?" }],
					},
				],
			});

			const result = await chat.sendMessage(
				"I am experiencing the following symptoms. Give me a list of diseases I might be suffering from." +
					userSymptoms
			);

			const responseText = result.response.text();
			req.session.userDiagnosis = responseText;
			res.redirect("/");
		} catch (error) {
			console.error("Error:", error);
			req.flash("error", "Error getting diagnosis. Please try again.");
			res.redirect("/");
		}
	}

	runChat();
});

app.delete("/logout", (req, res) => {
	req.logout((err) => {
		if (err) {
			console.error("Error during logout:", err);
			req.flash("error", "Failed to logout. Please try again.");
		}
		res.redirect("/login");
	});
});
function checkAuthenticated(req, res, next) {
	if (req.isAuthenticated()) {
		return next();
	}
	res.redirect("/login");
}

app.listen(3000, function () {
	console.log("Server is up and running on port 3000");
});
