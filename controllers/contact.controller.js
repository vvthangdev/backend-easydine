const Contact = require("../models/contact.model");

const createContact = async (req, res) => { 
    try {
        const contact = new Contact({...req.body});
        await contact.save();
        return res.status(200).json( {
            status: "SUCCESS",
            contact,
        } );
    } catch(e) {
        console.log(e);
        return res.status(500).json( {
            error: "Error when create contact"
        } );
    }
};
const getAllContacts = async (req, res) => { 
    try { 
        const contacts = await Contact.findAll();
        return res.status(200).json( {
            status: "SUCCESS",
            contacts,
        } );
    } catch(e) { 
        return res.status(500).json( {
            error: "Error when get all contacts"
        });
    }
}
module.exports = {
    createContact,
    getAllContacts
}