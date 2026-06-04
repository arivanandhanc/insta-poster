const dns = require("dns");
const https = require("https");

// Patch dns.lookup to fall back to Google DoH when local DNS fails (ENOTFOUND)
const _lookup = dns.lookup.bind(dns);

dns.lookup = function (hostname, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  _lookup(hostname, options, (err, address, family) => {
    if (!err) return callback(null, address, family);
    if (err.code !== "ENOTFOUND") return callback(err);

    // Local DNS failed — resolve via Google DoH
    https
      .get(`https://dns.google/resolve?name=${hostname}&type=A`, (r) => {
        let d = "";
        r.on("data", (c) => (d += c));
        r.on("end", () => {
          try {
            const j = JSON.parse(d);
            const ip = j.Answer?.find((a) => a.type === 1)?.data;
            if (ip) {
              callback(null, ip, 4);
            } else {
              callback(err);
            }
          } catch {
            callback(err);
          }
        });
      })
      .on("error", () => callback(err));
  });
};
