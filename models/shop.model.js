const mongoose = require("mongoose");

const shopSchema = mongoose.Schema({
  shop: {
    type: "String",
    required: true,
  },
  token: {
    type: "String",
  },
  active: {
    type: "Boolean",
    default: false
  },
  detail: {
    type: 'Object',
    default: {
      theme_installed: false,
      theme_installing: false,
      theme_version: null
    }
  }
});

module.exports = mongoose.model("Shop", shopSchema);
