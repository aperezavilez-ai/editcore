const fs = require("fs");
const cachePath =
  process.env.APPDATA +
  "/EditCore/CachedProfilesData/__default__profile__/extensions.builtin.cache";
const c = fs.readFileSync(cachePath, "utf8");
const j = JSON.parse(c);
for (const id of ["editcore.editcore-claude", "editcore.editcore-connect"]) {
  const x = j.result.find((r) => r.identifier?.id === id);
  if (!x) {
    console.log(id, "NOT IN CACHE");
    continue;
  }
  console.log(
    JSON.stringify(
      {
        id,
        type: x.type,
        error: x.error,
        location: x.location?.path,
        proposals: x.manifest?.enabledApiProposals,
        activation: x.manifest?.activationEvents?.slice(0, 4),
      },
      null,
      2
    )
  );
}
