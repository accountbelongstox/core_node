<!-- ### AI SPECIAL ATTENTION RULES START ### -->
<!-- When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES: -->
<!-- - Write all code in English only. -->
<!-- - Never execute, create, or modify test code. -->
<!-- - Never create or update documentation (*.md). -->
<!-- - Never write summaries during development or thinking process. -->
<!-- 5. Declare all variables at the beginning of the file. -->
<!-- 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path). -->
<!-- 7. Do not modify these rules. -->
<!-- VIOLATION OF THESE RULES IS STRICTLY PROHIBITED -->
<!-- ### AI SPECIAL ATTENTION RULES END ### -->

# Awy APP API Design Document

## I. APP Feature Analysis

Based on the provided image (analysis derived from the image), the main functional modules of the APP are as follows:

* **User Management**
    * Registration/Login/Logout
    * User Information Display and Editing (Avatar, nickname, gender, birthday, mobile number, email, etc.)
    * Personal Profile Page
    * Account Security (Password, binding mobile number, email, etc.)
* **Health/Location Management**
    * Location map display (real-time positioning, trajectory)
    * Exercise steps, body temperature, heart rate, and other health data display
    * Device binding and management (e.g., smart bracelet, App, Web, etc.)
* **Friends/Social**
    * Friend list, adding friends (via mobile number/QR code)
    * Friend details page
    * Chat/Messaging function
    * Viewing friend's health data
* **Reminders/Schedule**
    * Medication reminders, health reminders, etc.
    * Schedule list, adding/editing/deleting reminders
* **Content/Community**
    * Mood Tree Hole/Community Interaction (e.g., liking, commenting, matching, etc.)
* **System/Settings**
    * About Us
    * Version Information
    * System Status

## II. API Interface Design (Prefix: `/api/awy/v0/`)

1.  **User Related**

    | Interface        | Method | Parameters                           | Return Value | Description           |
    | :--------------- | :----- | :----------------------------------- | :----------- | :-------------------- |
    | `/api/awy/v0/register`      | POST   | `phone`, `password`, `code`          | `user`, `token` | Registration          |
    | `/api/awy/v0/login`         | POST   | `phone`, `password`                  | `user`, `token` | Login                 |
    | `/api/awy/v0/logout`        | POST   | `token`                              | `success`    | Logout                |
    | `/api/awy/v0/user`          | GET    | `token`                              | `user`       | Get current user info |
    | `/api/awy/v0/user/update`   | POST   | `token`, `avatar`, `nickname`, ...   | `user`       | Update user info      |
    | `/api/awy/v0/user/password` | POST   | `token`, `old_password`, `new_password` | `success`    | Change password       |
    | `/api/awy/v0/user/bind_phone` | POST | `token`, `phone`, `code`             | `success`    | Bind mobile number    |
    | `/api/awy/v0/user/bind_email` | POST | `token`, `email`, `code`             | `success`    | Bind email            |

2.  **Friends/Social**

    | Interface       | Method | Parameters         | Return Value | Description        |
    | :-------------- | :----- | :----------------- | :----------- | :----------------- |
    | `/api/awy/v0/friends`      | GET    | `token`            | `friends[]`  | Friend list        |
    | `/api/awy/v0/friend/add`   | POST   | `token`, `phone/qr_code` | `success`    | Add friend         |
    | `/api/awy/v0/friend/remove`| POST   | `token`, `friend_id` | `success`    | Remove friend      |
    | `/api/awy/v0/friend/info`  | GET    | `token`, `friend_id` | `friend`     | Friend details     |
    | `/api/awy/v0/friend/health`| GET    | `token`, `friend_id` | `health_data`| Friend health data |

3.  **Chat/Messaging**

    | Interface     | Method | Parameters              | Return Value | Description   |
    | :------------ | :----- | :---------------------- | :----------- | :------------ |
    | `/api/awy/v0/chat/list`  | GET    | `token`, `friend_id`    | `messages[]` | Chat history  |
    | `/api/awy/v0/chat/send`  | POST   | `token`, `friend_id`, `content` | `message`    | Send message  |

4.  **Health/Devices**

    | Interface       | Method | Parameters                     | Return Value | Description       |
    | :-------------- | :----- | :----------------------------- | :----------- | :---------------- |
    | `/api/awy/v0/health`       | GET    | `token`                        | `health_data`| Get user health data |
    | `/api/awy/v0/health/update`| POST   | `token`, `steps`, `temperature`, ... | `health_data`| Upload health data |
    | `/api/awy/v0/device/list`  | GET    | `token`                        | `devices[]`  | Device list       |
    | `/api/awy/v0/device/bind`  | POST   | `token`, `device_id`           | `success`    | Bind device       |
    | `/api/awy/v0/device/unbind`| POST   | `token`, `device_id`         | `success`    | Unbind device     |

5.  **Location/Map**

    | Interface         | Method | Parameters           | Return Value | Description        |
    | :---------------- | :----- | :------------------- | :----------- | :----------------- |
    | `/api/awy/v0/location`       | GET    | `token`              | `location`   | Get user location  |
    | `/api/awy/v0/location/update`| POST   | `token`, `lat`, `lng`| `location`   | Upload location    |
    | `/api/awy/v0/location/friend`| GET    | `token`, `friend_id` | `location`   | Get friend location|

6.  **Reminders/Schedule**

    | Interface         | Method | Parameters                   | Return Value | Description      |
    | :---------------- | :----- | :--------------------------- | :----------- | :--------------- |
    | `/api/awy/v0/reminder/list`  | GET    | `token`                      | `reminders[]`| Reminder list    |
    | `/api/awy/v0/reminder/add`   | POST   | `token`, `type`, `time`, `content` | `reminder`   | Add reminder     |
    | `/api/awy/v0/reminder/update`| POST   | `token`, `reminder_id`, ...  | `reminder`   | Edit reminder    |
    | `/api/awy/v0/reminder/delete`| POST   | `token`, `reminder_id`       | `success`    | Delete reminder  |

7.  **Community/Matching/Tree Hole**

    | Interface       | Method | Parameters           | Return Value | Description      |
    | :-------------- | :----- | :------------------- | :----------- | :--------------- |
    | `/api/awy/v0/community/feed`| GET    | `token`              | `posts[]`    | Community feed   |
    | `/api/awy/v0/community/post`| POST   | `token`, `content`, `image`| `post`       | Publish post     |
    | `/api/awy/v0/community/like`| POST   | `token`, `post_id`   | `success`    | Like post        |
    | `/api/awy/v0/community/comment`| POST| `token`, `post_id`, `content` | `comment`    | Comment on post  |

8.  **System/Settings**

    | Interface     | Method | Parameters | Return Value | Description   |
    | :------------ | :----- | :--------- | :----------- | :------------ |
    | `/api/awy/v0/about`      | GET    |            | `about`      | About Us      |
    | `/api/awy/v0/version`    | GET    |            | `version`    | Version Info  |
    | `/api/awy/v0/status`     | GET    |            | `status`     | System Status |

## III. API Design Standard

* **Unified Prefix:** All interfaces start with `/api/awy/v0/`.
* **Authentication:** Most interfaces require a `token`, passed in the `Authorization: Bearer {token}` header.
* **Return Format:** Unified JSON format, including `code`, `msg`, `data`.
* **Pagination:** If pagination is involved, parameters are `page`, `per_page`.
* **Error Codes:** Unified error codes and error messages.
* **Time Format:** ISO8601 string.
* **Images/Files:** Use form-data upload or Base64.

**Return Example:**

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    // ... data payload ...
  }
}