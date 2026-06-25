/**
 * Evita que chat.setupContext marque editcore-claude como disabled al arrancar.
 */
const fs = require("fs");
const path = require("path");

const MARKER = "EditCore: keep editcore-claude enabled";
const workbenchPath = path.join(
  __dirname,
  "..",
  "VSCode-win32-x64",
  "resources",
  "app",
  "out",
  "vs",
  "workbench",
  "workbench.desktop.main.js"
);

if (!fs.existsSync(workbenchPath)) {
  console.error("ERROR: no existe", workbenchPath);
  process.exit(1);
}

let src = fs.readFileSync(workbenchPath, "utf8");
if (src.includes(MARKER)) {
  console.log("OK: parche chat setup disabled ya aplicado");
  process.exit(0);
}

const from = `      context2.update({ installed, disabled, untrusted, disabledInWorkspace });
    }));
  }
};
ChatSetupContribution = __decorateClass([`;

const to = `      if (installed && ExtensionIdentifier.equals(defaultChatExtension.identifier.id, "editcore.editcore-claude")) {
        if (!this.extensionEnablementService.isEnabled(defaultChatExtension.local)) {
          void this.extensionEnablementService.setEnablement([defaultChatExtension.local], 12 /* EnabledGlobally */);
        }
        disabled = false;
        untrusted = false;
        disabledInWorkspace = false;
      } /* ${MARKER} */
      context2.update({ installed, disabled, untrusted, disabledInWorkspace });
    }));
  }
};
ChatSetupContribution = __decorateClass([`;

if (!src.includes(from)) {
  console.error("ERROR: bloque checkExtensionInstallation no encontrado");
  process.exit(1);
}

fs.writeFileSync(workbenchPath, src.replace(from, to), "utf8");
console.log("OK: parche chat setup ->", workbenchPath);
