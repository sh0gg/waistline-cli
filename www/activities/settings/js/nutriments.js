/*
  Copyright 2021 David Healey

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

app.Nutriments = {
  getNutriments: function() {
    return app.Settings.get("nutriments", "order") || app.nutriments;
  },

  getNutrimentUnits: function(alcoholVolPercent) {
    let nutrimentUnits = app.Utils.concatObjects(app.nutrimentUnits);
    let customUnits = app.Settings.get("nutriments", "units") || {};
    if (alcoholVolPercent === true)
      nutrimentUnits.alcohol = "% vol";
    return app.Utils.concatObjects(nutrimentUnits, customUnits);
  }
};
