const express = require("express");
const router = express.Router();

router.post("/getDiagnosis", (req, res) => {
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

module.exports = router;
