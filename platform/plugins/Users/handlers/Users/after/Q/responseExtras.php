<?php

function Users_after_Q_responseExtras() {
	if ($preloaded = Users_User::$preloaded) {
		Q_Response::setScriptData(
			'Q.plugins.Users.User.preloaded',
			Db::exportArray($preloaded, array('asAvatar' => true))
		);
	}
}
