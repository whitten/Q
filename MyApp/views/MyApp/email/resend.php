<p>
	Thanks for using <?php echo $app ?>, <?php echo $user->username ?>.
</p>

<p>
	You are receiving this email because someone entered your email address
	and clicked "forgot passphrase". If it wasn't you, simply ignore this message.
	
 	To reset your passphrase, click <?php echo Q_Html::a(
		'Users/activate?p=1&code='.urlencode($email->activationCode)
		 . ' emailAddress='.urlencode($email->address),
		'here'
	) ?>.
</p>

<p>
	See you on <a href="<?php echo Q_Request::baseUrl() ?>"><?php echo $app ?></a>!
</p>
