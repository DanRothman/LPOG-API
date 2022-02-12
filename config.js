module.exports = {
  childParentMap: function () {
      //console.log("in childParentMap");
      return {
        sensors:"facing",
        facings:"shelf",
        shelfs:"displayfixture",
        displayfixtures:"store",
        stores:"client"
      }
  },
  func2: function () {
    console.log("in func2");
  }
};