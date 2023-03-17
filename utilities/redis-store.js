const redis = require("redis");
const client = redis.createClient();
const { promisify } = require("util");
const getAsync = promisify(client.get).bind(client);
const setAsync = promisify(client.set).bind(client);
const delAsync = promisify(client.del).bind(client);

export async function storeCallback(session) {
  try {
    // Inside our try, we use the `setAsync` method to save our session.
    // This method returns a boolean (true is successful, false if not)
    return await setAsync(session.id, JSON.stringify(session));
  } catch (err) {
    // throw errors, and handle them gracefully in your application
    throw new Error(err);
  }
}

export async function loadCallback(id) {
  try {
    // Inside our try, we use `getAsync` to access the method by id
    // If we receive data back, we parse and return it
    // If not, we return `undefined`
    let reply = await getAsync(id);
    if (reply) {
      return JSON.parse(reply);
    } else {
      return undefined;
    }
  } catch (err) {
    throw new Error(err);
  }
}

export async function deleteCallback(id) {
  try {
    // Inside our try, we use the `delAsync` method to delete our session.
    // This method returns a boolean (true is successful, false if not)
    return await delAsync(id);
  } catch (err) {
    throw new Error(err);
  }
}
