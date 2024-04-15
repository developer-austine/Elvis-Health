const express = require("express");
const { getDb } = require("../db");
const { ObjectId } = require("mongodb");
const router = express.Router();
const geodist = require("geodist");

const app = express();
let db;

router.get("/hospitals", async (req, res) => {
	try {
		db = getDb();
		const hospitals = await db.collection("hospitalDetails").find().toArray();
		res.status(200).json(hospitals);
	} catch (error) {
		// Specify the error parameter
		console.error("Error fetching hospitals:", error);
		res.status(500).json({ error: "Could not fetch the documents" });
	}
});

router.get("/hospital/:id", async (req, res) => {
	try {
		db = getDb();
		const hospital = await db
			.collection("hospitalDetails")
			.findOne({ _id: new ObjectId(req.params.id) });
		if (hospital) {
			res.status(200).json(hospital);
		} else {
			res.status(404).json({ error: "Hospital not found" });
		}
	} catch (error) {
		res.status(500).json({ error: "Could not fetch the document" });
	}
});

router.get("/hospitals/proximity", async (req, res) => {
	const { longitude, latitude, amenity, more } = req.query;

	try {
		// Fetch hospitals data from the database
		db = getDb();
		const hospitals = await db.collection("hospitalDetails").find().toArray();

		// Filter hospitals by specified amenity
		const filteredHospitals = hospitals.filter(
			(hospital) =>
				hospital.properties.name &&
				hospital.properties.amenity !== null &&
				hospital.properties.amenity !== "*" &&
				hospital.properties.amenity === amenity
		);

		// Calculate distance and filter by proximity
		const closeHospitals = filteredHospitals
			.map((hospital) => {
				const { coordinates } = hospital.geometry;
				const dist = geodist(
					{ lat: coordinates[1], lon: coordinates[0] },
					{ lat: parseFloat(latitude), lon: parseFloat(longitude) },
					{ unit: "Km", exact: true }
				).toFixed(3);
				return {
					id: hospital._id,
					name: hospital.properties.name,
					amenity: hospital.properties.amenity,
					location: coordinates,
					proximity: dist,
				};
			})
			.filter((hospital) => hospital.proximity < 5);

		// Sort by proximity and limit results
		const limitedHospitals = closeHospitals
			.sort((a, b) => a.proximity - b.proximity)
			.slice(0, Number(more));

		res.status(200).json(limitedHospitals);
	} catch (error) {
		res.status(500).json({ error: "Could not fetch the documents" });
	}
});

module.exports = router; // Corrected export statement
