#!/usr/bin/env node

var fs = require('fs');
var path = require('path');
var watch = require('node-watch');
var shelljs = require('shelljs');
var Runtime = require('bayrell-runtime-nodejs');
var BayrellLang = require('bayrell-lang-nodejs');


class Module 
{
	constructor()
	{
		this.path = "";
		this.langs = [];
	}
}


class App
{
	constructor(path)
	{
		this.context = Runtime.RuntimeUtils.createContext();
		this.current_path = path;
		this.modules = [];
		this.parser_bay_factory = new BayrellLang.LangBay.ParserBayFactory(this.context);
		this.translator_es6_factory = new BayrellLang.LangES6.TranslatorES6Factory(this.context);
		this.translator_nodejs_factory = new BayrellLang.LangNodeJS.TranslatorNodeJSFactory(this.context);
		this.translator_php_factory = new BayrellLang.LangPHP.TranslatorPHPFactory(this.context);
	}
	addModule(path, langs)
	{
		var module = new Module();
		module.path = path;
		module.langs = langs;
		this.modules.push(module);
	}
	init(obj)
	{
		for (var i=0; i<obj.modules.length; i++)
		{
			var item = obj.modules[i];
			this.addModule( path.normalize(this.current_path + "/" + item.path), item.lang );
		}
	}
	loadConfig()
	{
		var json_path = this.current_path + "/project.json";
		if (!fs.existsSync(json_path))
		{
			console.log("Error. File " + json_path + " not found.");
			return false;
		}
		var success = false;
		var content = fs.readFileSync(json_path).toString();
		try
		{
			this.init( JSON.parse(content) );
			success = true;
		}
		catch(e)
		{
			console.log(e.toString());
		}
		return success;
	}
	onChange(eventType, file_path)
	{
		if (eventType == "update")
		{
			var stat = fs.lstatSync(file_path);
			if (stat.isFile())
			{
				this.onChangeFile(file_path);
			}
		}
	}
	onChangeFile(file_path)
	{
		var module = this.findModuleByFileName(file_path);
		if (module == null)
			return;
		this.onChangeFileInModule(module, file_path);
	}
	findModuleByFileName(file_path)
	{
		for (var i=0; i<this.modules.length; i++)
		{
			var module = this.modules[i];
			if (file_path.indexOf(module.path) == 0) return module;
		}
		return null;
	}
	onChangeFileInModule(module, file_path)
	{
		var lib_path = path.normalize(module.path + "/bay");
		if (file_path.indexOf(lib_path) == 0)
		{
			this.compileFileInModule(module, file_path);
		}
	}
	compileFileInModule(module, file_path)
	{
		var extname = path.extname(file_path).substr(1);
		if (extname == "bay")
		{
			console.log(file_path);
			
			try
			{
				for (var i=0; i<module.langs.length; i++)
				{
					var lang = module.langs[i];
					this.compileFile(module, file_path, "bay", lang);
				}
				console.log('Ok');
			}
			catch(e)
			{
				console.log(e.toString());
			}
			
		}
	}
	compileFile(module, file_path, lang_from, lang_to)
	{
		var lib_path = path.normalize(module.path + "/bay");
		var extname = path.extname(file_path);
		var basename = path.basename(file_path, extname);
		var relative_path = file_path.substr( lib_path.length + 1 );
		var dir_path = path.dirname(relative_path);
		extname = extname.substr(1);
		
		var save_dir = "";
		var save_ext = "";
		var translator = null;
		
		if (lang_to == "php")
		{
			save_dir = "php";
			save_ext = ".php";
			translator = this.translator_php_factory;
		}
		if (lang_to == "es6")
		{
			save_dir = "es6";
			save_ext = ".js";
			translator = this.translator_es6_factory;
		}
		if (lang_to == "nodejs")
		{
			save_dir = "nodejs";
			save_ext = ".js";
			translator = this.translator_nodejs_factory;
		}
		
		if (save_dir == "" || save_ext == "")
			return;
		
		var save_path = path.normalize(module.path + "/" + save_dir + "/" + dir_path + "/" + basename + save_ext);
		
		/* Compile */
		var content = fs.readFileSync(file_path).toString();
		var res = BayrellLang.Utils.translateSource(
			this.context, 
			this.parser_bay_factory, 
			translator,
			content
		);
		console.log('=>' + save_path);
		
		/* Save file */
		var dir_save_path = path.dirname(save_path);
		shelljs.mkdir('-p', dir_save_path);
		
		fs.writeFileSync(save_path, res);
	}
	watch()
	{
		console.log('Ready');
		watch(this.current_path, { recursive: true }, this.onChange.bind(this));
	}
}


module.exports = {
	"App": App,
	"Module": Module,
}
