/**
 * @module Q
 */
/**
 * Create custom exception
 * @class Exception
 * @namespace Q
 * @constructor
 * @param [message=""] {string} The error message
 * @param {object} fields={}
 */
var Exception = function (message, fields) {
	this.fields = fields || {};
	this.message = message || "";
};
Exception.prototype = Error;

module.exports = Exception;