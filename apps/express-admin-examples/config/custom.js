import { APPS_DIR,APP_DIR } from '#@/ncore/gvar/gdir.js';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DefaultConfig = {
    "Custom View - Basics": {
      "app": {
        "path": path.join(APP_DIR, 'custom/app1/app.js'),
        "slug": "view1",
        "verbose": "Hello Custom View",
        "mainview": {
          "show": true
        }
      }
    },
    "Custom View - Global Static Files": {
      "app": {
        "path"  : path.join(APP_DIR, 'custom/app2/app.js'),
        "slug": "view2",
        "verbose": "Custom Global Static Files",
        "mainview": {
          "show": true
        }
      },
      "public": {
        "local": {
          "path": path.join(APP_DIR, 'custom/app2/public'),
          "css": [
            "/css/global.css"
          ],
          "js": [
            "/js/global.js"
          ]
        }
      }
    },
    "Custom View - Local Static Files": {
      "app": {
        "path"  : path.join(APP_DIR, 'custom/app3/app.js'),
        "slug": "view3",
        "verbose": "Custom Local Static Files",
        "mainview": {
          "show": true
        }
      },
      "public": {
        "local": {
          "path": path.join(APP_DIR, 'custom/app3/public')
        }
      }
    },
    "Custom View - Breadcrumbs": {
      "app": {
        "path"  : path.join(APP_DIR, 'custom/app4/app.js'),
        "slug": "view4",
        "verbose": "Breadcrumbs",
        "mainview": {
          "show": true
        }
      }
    },
    "Custom View - Highcharts": {
      "app": {
        "path"  : path.join(APP_DIR, 'custom/highcharts/app.js'),
        "slug": "stats",
        "verbose": "Highcharts",
        "mainview": {
          "show": true
        }
      }
    },
    "Custom Component - Text Editors + Backend": {
      "app": {
        "path": path.join(APP_DIR, 'custom/editors/app.js'),
        "slug": "upload"
      },
      "public": {
        "external": {
          "js": [
            "https://cdn.ckeditor.com/4.4.2/standard/ckeditor.js",
            "https://cdn.tiny.cloud/1/no-api-key/tinymce/6/tinymce.min.js"
          ]
        },
        "local": {
          "path": path.join(APP_DIR, 'custom/editors'),
          "js": [
            "/editors.js"
          ]
        }
      }
    },
    "Custom Static Files": {
      "public": {
        "local": {
          "path": path.join(APP_DIR, 'custom/static'),
          "js": [
            "/mtm-tags.js",
            "/theme.js",
            "/images.js",
            "/binary.js"
          ]
        }
      }
    },
    "Event Hooks": {
      "events": path.join(APP_DIR, 'custom/events/events.js')
    }
  }
  
  export default DefaultConfig;
