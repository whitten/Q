<?php

/**
 * This tool renders a user avatar
 *
 * @param array $options
 * An associative array of parameters, containing:
 *   "userId" => The user's id. Defaults to id of the logged-in user, if any.
 *   "icon" => Optional. Render icon before the username.
 */
function Users_avatar_tool($options)
{
	$defaults = array(
		'icon' => false,
		'editable' => false
	);
	$options = array_merge($defaults, $options);
	Q_Response::addStylesheet('plugins/Q/css/Ui.css');
	Q_Response::setToolOptions($options);
	$user = !empty($options['userId'])
		? Users_User::getUser($options['userId'])
		: Users::loggedInUser();
	if (!$user) {
		return '';
	}
	$user->addPreloaded();
	$p = $options;
	$p['userId'] = $user->id;
	Q_Response::setToolOptions($p);
	$result = '';
	$icon = $options['icon'];
	if ($icon) {
		if ($icon === true) $icon = 40;
		$path = $user->iconPath();
		$result .= Q_Html::img("$path/$icon.png", 'user icon', array(
			'class' => 'Users_avatar_icon'
		));
	}
	$result .= '<span class="Users_avatar_name">' . $user->username . '</span>';
	return $result;
}
