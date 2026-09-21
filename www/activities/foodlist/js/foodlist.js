/*
  Copyright 2020, 2021 David Healey

  This file is part of Waistline.

  Waistline is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  Waistline is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with app.  If not, see <http://www.gnu.org/licenses/>.
*/

app.Foodlist = {
  getQuickAddItem: function() {
    return new Promise(async function(resolve, reject) {
      let item = await dbHandler.get("foodList", "barcode", "quick-add");

      if (item == undefined)
        item = await app.Foodlist.createQuickAddItem();

      let result = {
        id: item.id,
        portion: item.portion,
        type: "food"
      };

      resolve(result);
    });
  },

  getQuickAddItemDefinition: function() {
    let result = {
      name: "Quick Add",
      barcode: "quick-add",
      portion: 1,
      nutrition: {
        calories: 1
      },
      archived: true
    };

    return result;
  },

  createQuickAddItem: function() {
    return new Promise(function(resolve, reject) {

      item = app.Foodlist.getQuickAddItemDefinition();

      let request = dbHandler.put(item, "foodList");

      request.onsuccess = () => {
        item.id = request.result;
        resolve(item);
      };
    });
  }
};
