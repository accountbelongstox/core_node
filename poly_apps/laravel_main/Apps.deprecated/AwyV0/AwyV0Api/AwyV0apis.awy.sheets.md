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

Category	Path	Method	Major Parameters	Return Value	Description
User	/api/awy/v0/register	POST	phone, password, code	user, token	Registration
User	/api/awy/v0/login	POST	phone, password	user, token	Login
User	/api/awy/v0/logout	POST	token	success	Logout
User	/api/awy/v0/user	GET	token	user	Get current user
User	/api/awy/v0/user/update	POST	token, avatar, ...	user	Update user info
User	/api/awy/v0/user/password	POST	token, old_password, new_password	success	Change password
User	/api/awy/v0/user/bind_phone	POST	token, phone, code	success	Bind mobile
User	/api/awy/v0/user/bind_email	POST	token, email, code	success	Bind email
Friend	/api/awy/v0/friends	GET	token	friends[]	Friend list
Friend	/api/awy/v0/friend/add	POST	token, phone/qr_code	success	Add friend
Friend	/api/awy/v0/friend/remove	POST	token, friend_id	success	Remove friend
Friend	/api/awy/v0/friend/info	GET	token, friend_id	friend	Friend details
Friend	/api/awy/v0/friend/health	GET	token, friend_id	health_data	Friend health data
Chat	/api/awy/v0/chat/list	GET	token, friend_id	messages[]	Chat history
Chat	/api/awy/v0/chat/send	POST	token, friend_id, content	message	Send message
Health	/api/awy/v0/health	GET	token	health_data	Get user health
Health	/api/awy/v0/health/update	POST	token, steps, ...	health_data	Upload health data
Device	/api/awy/v0/device/list	GET	token	devices[]	Device list
Device	/api/awy/v0/device/bind	POST	token, device_id	success	Bind device
Device	/api/awy/v0/device/unbind	POST	token, device_id	success	Unbind device
Location	/api/awy/v0/location	GET	token	location	Get user location
Location	/api/awy/v0/location/update	POST	token, lat, lng	location	Upload location
Location	/api/awy/v0/location/friend	GET	token, friend_id	location	Get friend location
Reminder	/api/awy/v0/reminder/list	GET	token	reminders[]	Reminder list
Reminder	/api/awy/v0/reminder/add	POST	token, type, time, content	reminder	Add reminder
Reminder	/api/awy/v0/reminder/update	POST	token, reminder_id, ...	reminder	Edit reminder
Reminder	/api/awy/v0/reminder/delete	POST	token, reminder_id	success	Delete reminder
Community	/api/awy/v0/community/feed	GET	token	posts[]	Community feed
Community	/api/awy/v0/community/post	POST	token, content, image	post	Publish post
Community	/api/awy/v0/community/like	POST	token, post_id	success	Like post
Community	/api/awy/v0/community/comment	POST	token, post_id, content	comment	Comment on post
System	/api/awy/v0/about	GET		about	About Us
System	/api/awy/v0/version	GET		version	Version Info
System	/api/awy/v0/status	GET		status	System Status