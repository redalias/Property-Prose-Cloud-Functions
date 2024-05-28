const firebaseAdmin = require("firebase-admin");
const firestoreCollections = require("../values/firestore-collections");

async function addStripeEvent(data) {
  try {
    const db = firebaseAdmin.firestore();

    await db.collection(firestoreCollections.stripeEvents).add({
      date_created_firestore: firebaseAdmin.firestore.Timestamp.now(),
      event: data,
    });
  } catch (error) {
    console.error("Error adding Stripe event:", error);
  }
}

async function updateUser(userId, updatedData) {
  try {
    const db = firebaseAdmin.firestore();

    await db
      .collection(firestoreCollections.users)
      .doc(userId)
      .update(updatedData);

    console.log(
      "User " + userId + " updated successfully",
    );
  } catch (error) {
    console.error(
      "Error updating user " + userId,
    );

    console.error(error);
  }
}

async function user(userId) {
  try {
    const db = firebaseAdmin.firestore();

    let user = await db
      .collection(firestoreCollections.users)
      .doc(userId);

    console.log(
      "User " + userId + " updated successfully",
    );

    return user;
  } catch (error) {
    console.error(
      "Error fetching user " + userId,
    );

    console.error(error);
  }
}

module.exports = {
  addStripeEvent,
  updateUser,
  user,
};
