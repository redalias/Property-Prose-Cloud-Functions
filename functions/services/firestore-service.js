const admin = require("firebase-admin");
const firestoreCollections = require("../values/firestore-collections");

async function addPayment(data) {
  try {
    const db = admin.firestore();

    await db.collection(firestoreCollections.payments).add(data);
  } catch (error) {
    console.error("Error adding payment:", error);
  }
}

async function updateUser(userId, updatedData) {
  try {
    const db = admin.firestore();

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

module.exports = {
  addPayment,
  updateUser,
};
