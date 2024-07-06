const firebaseAdmin = require("firebase-admin");
const firestoreCollections = require("../values/firestore-collections");

const LoggingService = require("./logging-service");

class FirestoreService {
  constructor() {
    this.log = new LoggingService(this.constructor.name);
  }

  async addStripeEvent(data) {
    try {
      const db = firebaseAdmin.firestore();

      await db.collection(firestoreCollections.stripeEvents).add({
        date_created_firestore: firebaseAdmin.firestore.Timestamp.now(),
        event: data,
      });
    } catch (error) {
      this.log.error("Error adding Stripe event:", error);
    }
  }

  async updateUser(userId, updatedData) {
    try {
      const db = firebaseAdmin.firestore();

      await db
        .collection(firestoreCollections.users)
        .doc(userId)
        .update(updatedData);

      this.log.info(
        "User " + userId + " updated successfully",
      );
    } catch (error) {
      this.log.error(
        "Error updating user " + userId,
      );

      this.log.error(error);
    }
  }

  async user(userId) {
    try {
      const db = firebaseAdmin.firestore();

      let user = await db
        .collection(firestoreCollections.users)
        .doc(userId);

      this.log.info(
        "User " + userId + " updated successfully",
      );

      return user;
    } catch (error) {
      this.log.error(
        "Error fetching user " + userId,
      );

      this.log.error(error);
    }
  }
}

module.exports = FirestoreService;