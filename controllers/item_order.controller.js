const ItemOrdInfo = require("../models/item_order.model");
const itemOrdService = require("../services/item_order.service");

const getAllItemOrds = async (req, res) => {
  try {
    const itemOrds = await ItemOrdInfo.findAll();
    res.json(itemOrds);
  } catch (error) {
    res.status(500).json({ error: "Error fetching itemOrds" });
  }
};

const createItemOrd = async (req, res) => {
  try {
    const { ...itemOrdData } = req.body;
    const newItemOrd = await itemOrdService.createItemOrd({ ...itemOrdData });
    res.status(201).json(newItemOrd);
  } catch (error) {
    res.status(500).json({ error: "Error creating itemOrd" });
  }
};

// const updateItemOrd = async (req, res) => {
//   try {
//     const { id, ...otherFields } = req.body; // Adjust as needed to accept relevant fields
//     if (!id) {
//       return res.status(400).send("ItemOrd id required.");
//     }
//     if (!otherFields || Object.keys(otherFields).length === 0) {
//       return res.status(400).send("No fields to update.");
//     }
//     // Update the user information in the database
//     const updatedItemOrd = await itemOrdService.updateItemOrd(id, {
//       ...otherFields, // Spread other fields if there are additional updates
//     });

//     if (!updatedItemOrd) {
//       return res.status(404).send("ItemOrd not found!");
//     }
//     res.json({
//       status: "SUCCESS",
//       message: "ItemOrd updated successfully!",
//       ItemOrd: updatedItemOrd,
//     });
//   } catch (error) {
//     res.status(500).json({ error: "Error updating itemOrd" });
//   }
// };

// const searchItemOrd = async (req, res) => {
// //   console.log(req.body);
//   try {
//     let { ...otherFields } = req.body; // Adjust as needed to accept relevant fields
//     // console.log(otherFields);

//     if (!otherFields || Object.keys(otherFields).length === 0) {
//       return res.status(400).send("ItemOrd info required.");
//     }

//     const itemOrd = await itemOrdService.searchItemOrd(...otherFields);

//     // Update the user information in the database
//     // const updatedUser = await userService.updateUser(req.user.username, {
//     //   ...otherFields, // Spread other fields if there are additional updates
//     // });

//     // if (!updatedUser) {
//     //   return res.status(404).send("User not found!");
//     // }
//     console.log(itemOrd);
//     res.status(200).json({ itemOrd: itemOrd });
//   } catch (error) {
//     res.status(500).json({ error: "Error fetching itemOrd" });
//   }
// };

// const deleteItemOrd = async (req, res) => {
//   try {
//     console.log(req.body.id);
//     const itemOrd = await itemOrdService.getItemOrdByItemOrdId(req.body.id);
//     if (itemOrd) {
//       await itemOrd.destroy();
//       res.json({ message: "ItemOrd deleted" });
//     } else {
//       res.status(404).json({ error: "ItemOrd not found" });
//     }
//   } catch (error) {
//     res.status(500).json({ error: "Error deleting itemOrd" });
//   }
// };

module.exports = {
  getAllItemOrds,
  createItemOrd,
  // updateItemOrd,
  // searchItemOrd,
  // deleteItemOrd,
};
