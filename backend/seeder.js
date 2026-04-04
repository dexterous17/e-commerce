import colors from "colors";

import "./config/loadEnv.js";
import users from "./data/users.js";
import products from "./data/products.js";

import connectDB, { withTransaction } from "./config/db.js";
import {
  deleteAllSeedManifest,
  upsertSeedManifest,
} from "./models/seedManifestModel.js";
import { deleteAllOrders } from "./models/orderModel.js";
import { deleteAllProducts, insertProducts } from "./models/productModel.js";
import { deleteAllUsers, insertUsers } from "./models/userModel.js";

const importData = async () => {
  try {
    await connectDB();

    await withTransaction(async (client) => {
      await deleteAllSeedManifest(client);
      await deleteAllOrders(client);
      await deleteAllProducts(client);
      await deleteAllUsers(client);

      const createdUsers = await insertUsers(users, client);
      const adminUser = createdUsers[0]._id;
      const sampleProducts = products.map((product) => ({
        ...product,
        user: adminUser,
        seedSource: "products-local-seed",
      }));

      await insertProducts(sampleProducts, client);
      await upsertSeedManifest(
        {
          source: "products-local-seed",
          stats: {
            users: createdUsers.length,
            products: sampleProducts.length,
          },
          rawManifest: {
            mode: "local",
          },
        },
        { client }
      );
    });

    console.log("Data has been imported!".green.inverse);
    process.exit();
  } catch (error) {
    console.error(`Error: ${error.message}`.red.inverse);
    process.exit(1);
  }
};

const destroyData = async () => {
  try {
    await connectDB();

    await withTransaction(async (client) => {
      await deleteAllSeedManifest(client);
      await deleteAllOrders(client);
      await deleteAllProducts(client);
      await deleteAllUsers(client);
    });

    console.log("Data has been destroyed!".red.inverse);
    process.exit();
  } catch (error) {
    console.error(`Error: ${error.message}`.red.inverse);
    process.exit(1);
  }
};

if (process.argv[2] === "-d") {
  destroyData();
} else {
  importData();
}
