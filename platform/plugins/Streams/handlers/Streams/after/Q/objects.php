<?php

function Streams_after_Q_objects () {
	$user = Users::loggedInUser();
	if (!$user) return;
	$invite = Streams::$followedInvite;
	if (!$invite) return;
	$displayName = $user->displayName();
	if ($displayName) return;

	$stream = new Streams_Stream();
	$stream->publisherId = $invite->publisherId;
	$stream->name = $invite->streamName;
	if (!$stream->retrieve()) {
		throw new Q_Exception_MissingRow(array(
			'table' => 'stream',
			'criteria' => 'that name'
		), 'streamName');
	}

	// Prepare the complete invite dialog
	$defaults = Q_Config::get("Streams", "types", $stream->type, "invite", "dialog",
		Q_Config::get("Streams", "defaults", "invite", "dialog", array())
	);

	$invitingUser = Users_User::getUser($invite->invitingUserId);
	list($relations, $related) = Streams::related(
		$user->id,
		$stream->publisherId,
		$stream->name,
		false
	);
	
	$params = array(
		'displayName' => $displayName,
		'action' => 'Streams/basic',
		'icon' => Q_Html::themedUrl("plugins/Users/img/icons/{$user->icon}"),
		'token' => $invite->token,
		'user' => array(
			'icon' => Q_Html::themedUrl("plugins/Users/img/icons/{$invitingUser->icon}"),
			'name' => $invitingUser->displayName()
		),
		'stream' => $stream->exportArray(),
		'relations' => Db::exportArray($relations),
		'related' => Db::exportArray($related)
	);

	$tree = new Q_Tree($defaults);
	if ($tree->merge($params)) {
		$dialogData = $tree->getAll();
		if ($dialogData) {
			Q_Response::setScriptData('Q.plugins.Streams.invite.dialog', $dialogData);
			Q_Response::addTemplate('Streams/invite/complete');
		}
	}
}
