const firebaseAdmin = require("firebase-admin");
const firestoreCollections = require("../values/firestore-collections");

const LoggingService = require("./logging-service");

class FirestoreService {
  constructor() {
    this.logger = new LoggingService(this.constructor.name);
  }

  async addStripeEvent(data) {
    try {
      const db = firebaseAdmin.firestore();

      await db.collection(firestoreCollections.stripeEvents).add({
        date_created_firestore: firebaseAdmin.firestore.Timestamp.now(),
        event: data,
      });
    } catch (error) {
      this.logger.error("Error adding Stripe event:", error);
    }
  }

  async updateUser(userId, updatedData) {
    try {
      const db = firebaseAdmin.firestore();

      await db
        .collection(firestoreCollections.users)
        .doc(userId)
        .update(updatedData);

      this.logger.info(
        "User " + userId + " updated successfully",
      );
    } catch (error) {
      this.logger.error(
        "Error updating user " + userId,
      );

      this.logger.error(error);
    }
  }

  async user(userId) {
    try {
      const db = firebaseAdmin.firestore();

      let user = await db
        .collection(firestoreCollections.users)
        .doc(userId);

      this.logger.info(
        "User " + userId + " updated successfully",
      );

      return user;
    } catch (error) {
      this.logger.error(
        "Error fetching user " + userId,
      );

      this.logger.error(error);
    }
  }
}

module.exports = FirestoreService;