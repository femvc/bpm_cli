'use strict';
//   __    __           ______   ______  _____    __  __     
//  /\ \  /\ \ /'\_/`\ /\  _  \ /\__  _\/\  __`\ /\ \/\ \    
//  \ `\`\\/'//\      \\ \ \/\ \\/_/\ \/\ \ \/\ \\ \ \ \ \   
//   `\ `\ /' \ \ \__\ \\ \  __ \  \ \ \ \ \ \ \ \\ \ \ \ \  
//     `\ \ \  \ \ \_/\ \\ \ \/\ \  \ \ \ \ \ \_\ \\ \ \_\ \ 
//       \ \_\  \ \_\\ \_\\ \_\ \_\  \ \_\ \ \_____\\ \_____\
//        \/_/   \/_/ \/_/ \/_/\/_/   \/_/  \/_____/ \/_____/
//                                                                   

/**
 * @name @name 页面流程控制类
 * @public
 * @author wanghaiyang
 * @date 2014/05/05
 * @param {Object} options 控件初始化参数.
 */
hui.define('hui_action', ['hui_template', 'hui_control'], function () {

    hui.BaseModel = function (data) {
        hui.EventDispatcher.call(this);

        var _model = {};
        /**
         * @name 设置新的值，如果两个值不同，就会触发PropertyChangedEvent.
         * @param {String|Object} propertyName 需要设置的属性或数据对象.
         * @param {Any} value 属性的值.
         * @comment 接受`"key", value` 和 `{key: value}`两种的方式赋值.
         */
        this.set = function (propertyName, newValue) {
            var attr,
                attrs,
                changes = [],
                newValue,
                className = Object.prototype.toString.call(propertyName);

            if ((className !== '[object Object]' && className !== '[object String]') ||
                (className === '[object Object]' && newValue !== undefined)) {
                return this.trigger('SET_ERROR', propertyName, newValue);
            }

            if (className == '[object String]') {
                attrs = {};
                attrs[propertyName] = newValue;
            }
            else {
                attrs = propertyName;
            }

            for (attr in attrs) {
                if (!Object.prototype.hasOwnProperty.call(_model, attr)) {
                    changes.push([attr, undefined, hui.BaseModel.clone(attrs[attr])]);
                    _model[attr] = newValue;
                }
                else if (typeof JSON !== 'undefined' && JSON.stringify(_model[attr]) != JSON.stringify(attrs[attr])) {
                    changes.push([attr, hui.BaseModel.clone(_model[attr]), hui.BaseModel.clone(attrs[attr])]);
                    _model[attr] = attrs[attr];
                }
                // IE6,7 can not use JSON.stringify(), just use simple compare.
                else if (_model[attr] !== attrs[attr]) {
                    changes.push([attr, hui.BaseModel.clone(_model[attr]), hui.BaseModel.clone(attrs[attr])]);
                    _model[attr] = attrs[attr];
                }
            }

            // Trigger all relevant attribute changes.
            for (var i = 0, len = changes.length; i < len; i++) {
                this.trigger('change:' + changes[i][0], changes[i][1], changes[i][2]);
            }
            if (changes.length) {
                this.trigger('change');
            }
        };

        /**
         * @name 获取指定属性值
         * @param {String} propertyName 属性名.
         * @return {*} 属性的值.
         */
        this.get = function (propertyName) {
            return hui.BaseModel.clone(_model[propertyName]);
        };
        /**
         * @name 获取所有的属性值
         * @return {Map} 所有的属性值.
         */
        this.getData = function () {
            return hui.BaseModel.clone(_model);
        };
        /**
         * @name 移除指定属性值
         * @param {String} propertyName 属性名.
         * @return {*} 属性的值.
         */
        this.remove = function (propertyName) {
            var value = _model[propertyName];
            this.set(propertyName, undefined);
            delete _model[propertyName];
            return value;
        };
        /**
         * @name 销毁Model
         * @return {void}
         */
        this.dispose = function () {
            this._listeners = undefined;
            _model = undefined;
        };

        var child = _model,
            parent = data;
        for (var key in parent) {
            if (parent.hasOwnProperty(key)) {
                child[key] = parent[key];
            }
        }
    };
    hui.inherits(hui.BaseModel, hui.EventDispatcher);

    /** 
     * @name对一个object进行深度拷贝
     * @param {Any} source 需要进行拷贝的对象.
     * @param {Array} oldArr 源对象树索引.
     * @param {Array} newArr 目标对象树索引.
     * @return {Any} 拷贝后的新对象.
     */
    hui.BaseModel.clone = function (source, oldArr, newArr) {
        if (typeof source === 'undefined') {
            return undefined;
        }
        if (typeof JSON !== 'undefined') {
            return JSON.parse(JSON.stringify(source));
        }

        var result = source,
            i,
            len,
            j,
            len2,
            exist = -1;
        oldArr = oldArr || [];
        newArr = newArr || [];

        if (source instanceof Date) {
            result = new Date(source.getTime());
        }
        else if ((source instanceof Array) || (Object.prototype.toString.call(source) == '[object Object]')) {
            for (j = 0, len2 = oldArr.length; j < len2; j++) {
                if (oldArr[j] == source) {
                    exist = j;
                    break;
                }
            }
            if (exist != -1) {
                result = newArr[exist];
                exist = -1;
            }
            else {
                if (source instanceof Array) {
                    result = [];
                    oldArr.push(source);
                    newArr.push(result);
                    var resultLen = 0;
                    for (i = 0, len = source.length; i < len; i++) {
                        result[resultLen++] = hui.util.clone(source[i], oldArr, newArr);
                    }
                }
                else if (!!source && Object.prototype.toString.call(source) == '[object Object]') {
                    result = {};
                    oldArr.push(source);
                    newArr.push(result);
                    for (i in source) {
                        if (source.hasOwnProperty(i)) {
                            result[i] = hui.util.clone(source[i], oldArr, newArr);
                        }
                    }
                }
            }
        }

        return result;
    };

    hui.Flow = function () {
        this.que = []; // 注：存放要调用的函数列表
        this.id = Math.random(); // 注：仅用于标示，不会被调用（即使删掉也没什么影响）
    };

    /**  
     * @name 添加需要异步执行的函数
     * @param {Function} fn 需要异步执行的函数
     * @return {this} 返回主体以便于后续操作
     */
    hui.Flow.prototype.push = function (fn, target) {
        var me = this,
            _fn = target ? hui.fn(fn, target) : fn,
            callback = hui.fn(me.next, me);

        fn = function () {
            _fn(callback);
        };
        me.que.push(fn);

        return me;
    };

    /**  
     * @name 开始执行异步队列
     * @param {Function} callback 嵌套时的回调函数，其实就是hui.Flow.prototype.next
     * @return {void}
     */
    hui.Flow.prototype.next = function (callback) {
        if (callback) {
            callback();
        }

        if (this.que.length > 0) {
            var fn = this.que.shift();
            fn();
        }
    };

    /**  
     * @name Javascript简单异步框架 
     * @property {Array} que 保存回调队列  
     * @method {Function} push 添加需要异步执行的函数
     * @method {Function} next 开始执行异步队列
     * @comment 异步队列中的函数需要实现callback的接口
     * @example
         function doit() {
            alert('a');
            
            var que1 = new hui.Flow();
            que1.push(a);
            que1.push(d); 
            setTimeout(function(){
                que1.next();
            },400);
        }

         function a(callback) {
            alert('a');
            
            var que2 = new hui.Flow();
            que2.push(b).push(c).push(callback); 
            
            setTimeout(function(){
                que2.next();
            },400);
        }
        function b(callback) {
            alert('b');
            callback&&callback();
        }
        function c(callback) {
            alert('c');
            callback&&callback();
        }
     */


    hui.Action = function (options) {
        // 防止重复执行!!
        if (this.baseConstructed) {
            return this;
        }
        hui.Action.superClass.call(this, options, 'pending');
        /**
         * @name Action的页面主元素ID[容器]
         * @public
         * @return {Map}
         */
        this.main = null;
        // Action的模板名
        this.view = null;
        // Action实例化时需要提前加载的model数据
        this.PARAM_MAP = {};
        // Action的数据模型
        var baseModel = hui.Action.getExtClass('hui.BaseModel');
        this.model = new baseModel();
        // Action的顶层控件容器
        this.controlMap = [];
        // 声明类型
        this.type = 'action';

        // 是否执行过构造过程
        this.baseConstructed = true;

        hui.Control.appendControl(hui.Action, this);

        // enterControl需要在实例化时调用，这里不能直接进!
        // this.enterControl()
    };

    hui.Action.prototype = {
        /**
         * @name 获取视图模板名
         * @protected
         * @return {String} target名字
         * @default 默认为action的id
         */
        getView: function () {
            var view = (this.view === null ? this.id : this.view);
            // 获取view
            if (typeof view === 'function') {
                view = view();
            }
            view = hui.Action.getExtClass('hui.Template').getTarget(String(view));

            return view;
        },
        /**
         * @name Action的主要处理流程
         * @protected
         * @param {Object} argMap arg表.
         */
        enterControl: function (args) {
            var me = this,
                que;
            // 创建一个异步队列     
            que = new hui.Flow(); // 注：可以参照hui_flow.js文件。非常简单，不到30行代码
            que.push(function (next) {
                var me = this;
                //Action渲染过程中禁止跳转，否则容易造成死循环。
                hui.Action.getExtClass('hui.Master').ready = false;

                // 设为活动action 
                me.active = true;

                var elem,
                    uiObj = me,
                    MAIN_ID = document.getElementById(hui.Action.MAIN_ID);
                // 注：默认增加一个空元素作为控件主元素!
                elem = (uiObj.getMain ? uiObj.getMain() : null) || (uiObj.createMain ? uiObj.createMain() : hui.Control.prototype.createMain.call(uiObj));
                if (elem && MAIN_ID) {
                    document.getElementById(hui.Action.MAIN_ID).appendChild(elem);
                }
                if (!elem) {
                    return hui.Control.error('Action\'s main element is invalid');
                }
                // 便于通过elem.getAttribute('control')找到control
                elem.setAttribute('control', uiObj.getId ? uiObj.getId() : uiObj.id);

                // 保存通过URL传过来的参数
                me.args = args;

                // 判断model是否存在，不存在则新建一个
                if (!me.model) {
                    var baseModel = hui.Action.getExtClass('hui.BaseModel');
                    me.model = new baseModel();
                }

                // 先将PARAM_MAP中的key/value装入model
                for (var k in me.PARAM_MAP) {
                    if (k) {
                        me.model.set(k, me.PARAM_MAP[k]);
                    }
                }

                next && next();
            }, me);

            // 初始化Model
            que.push(me.initModel, me);
            // 初始化View
            que.push(me.initView, me);

            que.push(function (next) {
                var me = this;
                var mainHTML,
                    tpl;
                // 渲染视图
                if (me.main) {
                    tpl = me.getView();
                    mainHTML = hui.Action.getExtClass('hui.Template').merge(tpl, me.model.getData());
                    me.setInnerHTML(me, mainHTML);
                }
                me.render();
                me.rendered = 'true';

                // 渲染当前view中的控件
                hui.Action.getExtClass('hui.Control').init(me.getMain(), me.model, me);

                // 控件事件绑定
                me.initBehavior();

                // hui.Action.getExtClass('hui.Mask').hideLoading();
                // 渲染结束，检查渲染期间是否有新请求
                hui.Action.getExtClass('hui.Master').checkNewRequest();

                next && next();
            }, me);

            que.next();
        },
        /**
         * @name 初始化数据模型
         * @protected
         * @param {Object} argMap 初始化的参数.
         */
        initModel: function (callback) {
            callback && callback();
        },
        // checkAuthority: function(){},
        /**
         * @name 根据控件formName找到对应控件
         * @static
         * @param {String} 控件formName
         */
        getByFormName: function (formName) {
            return hui.Control.getByFormName(formName, this);
        },
        /**
         * @name 提交完成的事件处理函数,提示完成
         * @private
         * @param {Object} data 提交的返回数据.
         */
        onsubmitfinished: function (data) {
            // Todo: 
        },
        /**
         * @name 释放控件
         * @protected
         */
        dispose: function () {
            var me = this;

            me.leave();

            hui.Control.prototype.dispose.call(me);

            if (me.model && me.model.dispose) {
                me.model.dispose();
                me.model = undefined;
            }

            me.active = null;

            me.clear();
        },
        /**
         * @name 后退
         * @protected
         */
        back: function () {
            hui.Action.getExtClass('hui.Master').back();
        },
        /**
         * @name 退出
         * @public
         */
        leave: function () {}
    };

    hui.inherits(hui.Action, hui.Control);

    /**
     * @name 通过Action类派生出action
     * @public
     * @param {Object} action 对象
     * @public
     */
    hui.Action.derive = function (action) {
        var me,
            i,
            instance,
            func = function () {},
            type = Object.prototype.toString.call(action);
        // 传进来的是一个Function
        if (type == '[object Function]') {
            hui.inherits(action, hui.Action);
            hui.inherits(func, action);

            // 相当于在传入的构造函数最前面执行hui.Action.call(this);
            instance = new func();
            hui.Action.call(instance);
            action.call(instance);
            /**/
        }
        // 传进来的是一个单例object
        else if (type == '[object Object]' || type == '[object String]') {
            action = type == '[object String]' ? hui.window[action] : action;

            me = new hui.Action();
            for (i in me) {
                if (action[i] === undefined) {
                    action[i] = me[i];
                }
            }
            hui.Action.controlMap.push(action);
        }
    };
    hui.Action.MAIN_ID = 'main';
    /**
     * @name Action的静态属性[索引Action]
     */
    hui.Action.controlMap = [];

    /**
     * @name 获取action
     * 获取控件用hui.Action.getExtClass('hui.Control').get(id, ctr||action)
     */
    hui.Action.get = function (id) {
        var list = hui.Action.controlMap,
            action,
            v,
            cur;
        for (var i = 0, len = list.length; i < len; i++) {
            v = list[i];
            if (id !== undefined && v && v.id !== undefined && String(v.id) === String(id)) {
                action = list[i];
            }
            if (v && v.active) {
                cur = list[i];
            }
        }
        return (id !== undefined ? action : cur);
    };
    /**
     * @name 根据action的构造类或单例来从索引中找到已存在的action实例
     * @param {Function|Object} actionName action的单例或构造类
     */
    hui.Action.getByActionName = function (actionName) { /*接收参数:Action子类|Action子类名|Object，返回action实例*/
        var list = hui.Action.controlMap,
            action = null,
            v,
            action_constructor;
        if (actionName) {
            // Action function
            action_constructor = Object.prototype.toString.call(actionName) === '[object Function]' ? actionName : (hui[actionName] || hui.Action.getObjectByName(actionName));
            if (action_constructor && Object.prototype.toString.call(action_constructor) === '[object Function]') {
                for (var i = 0, len = list.length; i < len; i++) {
                    v = list[i];
                    if (v instanceof action_constructor && v.constructor === action_constructor) {
                        action = list[i];
                    }
                }
            }
            // Object
            else {
                for (var i = 0, len = list.length; i < len; i++) {
                    v = list[i];
                    if (v === actionName) {
                        action = list[i];
                    }
                }
            }
        }

        return action;
    };

    /**
     * @name 移除action的索引
     * @public
     * @param {Object} action 对象
     * @public
     */
    hui.Action.removeActionIndex = function (action) {
        var list = hui.Action.controlMap,
            i;
        for (var i = 0, len = list.length; i < len; i++) {
            if (list[i] === action) {
                list[i] = undefined;
            }
        }
    };


    /**
     * @name 获取唯一id
     * @public
     * @return {String}
     */
    hui.Action.makeGUID = (function () {
        var guid = 1;
        return function (formName) {
            return '_' + (formName ? formName : 'inner') + '_' + (guid++);
        };
    })();

    /** 
     * @name 根据字符串查找对象
     * @param {String} name 对象对应的字符串
     * @param {Object} opt_obj 父对象
     * @public
     */
    hui.Action.getObjectByName = function (name, opt_obj) {
        var parts = name.split('.'),
            part,
            cur = opt_obj || hui.window;
        while (cur && (part = parts.shift())) {
            cur = cur[part];
        }
        return cur;
    };

    hui.Action.getExtClass = function (clazz) {
        var result = function () {};
        switch (clazz) {
        case 'hui.Control':
            if (typeof hui !== 'undefined' && hui && hui.Control) {
                result = hui.Control;
            }
            else {
                result.get = new Function();
                result.init = new Function();
                result.prototype.validate = new Function();
                result.prototype.getParamMap = new Function();
                result.prototype.validateAndSubmit = new Function();
            }
            break;
        case 'hui.Template':
            if (typeof hui !== 'undefined' && hui && hui.Template) {
                result = hui.Template;
            }
            else {
                result.getTarget = new Function();
                result.merge = new Function();
            }
            break;
        case 'hui.Mask':
            if (typeof hui !== 'undefined' && hui && hui.Mask) {
                result = hui.Mask;
            }
            else {
                result.hideLoading = new Function();
            }
            break;
        case 'hui.Master':
            if (typeof hui !== 'undefined' && hui && hui.Master) {
                result = hui.Master;
            }
            else {
                result.checkNewRequest = new Function();
                result.back = new Function();
            }
            break;
        case 'hui.BaseModel':
            if (typeof hui !== 'undefined' && hui && hui.BaseModel) {
                result = hui.BaseModel;
            }
            else {
                result.prototype.set = new Function();
            }
            break;
        default:
        }
        return result;
    };


    hui.Router = {
        pathRules: [],
        /**
         * 根据location找到匹配的rule并返回对应的action
         *
         * @public
         * @param {String} loc 路径
         */
        findAction: function (loc) {
            var me = this,
                pathRules = me.pathRules,
                i, len, matches, rule,
                action = null;
            //匹配所有符合表达式的路径
            for (i = 0, len = pathRules.length; i < len; i++) {
                rule = pathRules[i].location;
                if (rule && (rule instanceof RegExp) && (matches = rule.exec(loc)) !== null) {
                    action = pathRules[i].action;
                }
            }
            //[优先]匹配单独具体路径
            for (i = 0, len = pathRules.length; i < len; i++) {
                rule = pathRules[i].location;
                if (rule && (typeof rule == 'string') && rule == loc) {
                    action = pathRules[i].action;
                }
            }

            if (!action && hui.window.console && hui.window.console.error) {
                hui.window.console.error('Route \'%s\' is not defined. Please use hui.Router.setRule(\'%s\', \'xxx\');', loc, loc);
            }

            return action;
        },
        /**
         * 设置rule
         *
         * @public
         * @param {String} rule 路径
         * @param {String} action 对应action
         */
        setRule: function (rule, action) {
            this.pathRules.push({
                'location': rule,
                'action': action
            });
        },
        /**
         * 载入完成读取所有rule
         *
         * @protected
         * @param {String} rule 路径
         * @param {String} func 对应action
         */
        init: function (modules) {
            // Todo:
        },

        //错误处理
        error: function (msg) {
            msg = 'error: ' + msg;
            if (hui.window.console) {
                hui.window.console.log(msg);
            }
            else throw Error(msg);
        }
    };

    hui.Master = {
        historyList: [],
        newRequest: null,
        ready: true,
        checkNewRequest: function () {
            var me = this,
                url = me.newRequest;

            me.ready = true;

            if (url) {
                me.newRequest = null;
                me.forward(url);
            }
        },

        //仅供redirect时调用,必须保证url对应的action是有效的,跳转过程中不操作url,不推荐外部直接调用!!!
        forward: function (url) {
            var me = this;
            // 注：由于forward的过程中不改变url，因此将可能改变url的hui.Permission.checkRouter放到hui.Locator.switchToLocation中了
            // 这里不可以通过me.getExtClass()去取!!
            // if (hui.Permission && hui.Permission.checkRouter) {
            //     hui.Permission.checkRouter(url, hui.fn(me.forwardCallback, me));
            // }
            // else {
            me.forwardCallback(url);
            //}
        },
        // 权限验证可能是一个异步过程!!
        forwardCallback: function (url) {
            var me = this,
                result, loc, args,
                action = null;

            // Action渲染过程中禁止跳转，否则容易造成死循环，缓存新请求。
            if (me.ready === false) {
                me.newRequest = url;
            }
            if (me.ready === true) {
                result = me.parseLocator(url);
                loc = result['location'];
                args = result['query'];

                // 首先销毁当前action的实例
                if (me.historyList[me.historyList.length - 1]) {
                    me.disposeAction(me.parseLocator(me.historyList[me.historyList.length - 1])['location']);
                }

                // 找到匹配的路径规则(该过程中会创建action实例)
                action = me.getActionInstance(me.findActionName(loc)); /* me.getActionInstance参数可以接收'变量名'|'单例'|'Action子类' */

                if (action && action.enterControl) {
                    //Action渲染过程中禁止跳转，否则容易造成死循环。
                    // 注：为解决手动构造action当url变化时不能刷新的问题，将me.ready = false; 移到了enterControl()中
                    //me.ready = false;
                    //时间不长则无需显示等待中
                    //hui.Mask.timer = hui.window.setTimeout('hui.Mask.showLoading()',300);
                    //me.getExtClass('hui.Mask').showLoading();

                    me.historyList.push(url);
                    action.enterControl(args);
                }
            }
        },
        back: function () {
            var me = this,
                result, loc;

            //有历史记录
            if (me.historyList.length > 1) {
                //当前action
                result = me.parseLocator(me.historyList.pop());
                loc = result['location'];

                me.disposeAction(loc);

                me.ready = true;
                //后退一步
                me.getExtClass('hui.Locator').redirect(me.historyList.pop());
            }
            //无历史记录
            else {
                //当前action
                result = me.parseLocator(me.historyList[me.historyList.length - 1]);
                loc = result['location'];

                //跳转到指定后退location
                loc = me.disposeAction(loc);
                if (loc) {
                    me.getExtClass('hui.Locator').redirect(loc);
                }
            }
        },
        /**
         * @name 根据loc找到action
         * @private
         * @param {String} loc
         * @param {String} log 是否显示错误提示，disposeAction()时无需显示错误提示
         * @result {String} actionName
         */
        findActionName: function (loc, nolog) {
            var me = this,
                action = me.getExtClass('hui.Router').findAction(loc),
                actionClazz = action ? me.getActionConstructor(action) : null;
            if (!actionClazz) {
                // 找不到对应Action
                if (nolog !== 'nolog' && hui.window.console && hui.window.console.error) {
                    hui.window.console.error('hui.Router.setRule(\'%s\', \'%s\'); Action \'%s\' is not exist.', loc, action, action);
                }
                // 找不到则返回404
                if (loc !== '/404') {
                    action = me.findActionName('/404');
                }
            }
            return action;
        },
        /**
         * @name 根据loc找到action
         * @private
         * @param {String} loc
         */
        disposeAction: function (loc) {
            var me = this,
                action = me.getExtClass('hui.Action').getByActionName(me.findActionName(loc, 'nolog')),
                /* getByActionName参数可以接收'变量名'|'单例'|'Action子类' */
                defaultBack = (action && action.BACK_LOCATION) ? action.BACK_LOCATION : null;

            if (action && action.dispose) {
                action.dispose();
            }

            return defaultBack;
        },
        /**
         * @name 返回对应action的构造类
         * @private
         * @param {String} action clazz
         */
        getActionConstructor: function (action) {
            if (hui[action]) {
                action = hui[action];
            }
            else if (typeof action == 'string') {
                action = hui.Action.getObjectByName(action);
            }
            return action;
        },
        /**
         * @name 返回对应action的实例
         * @private
         * @param {Function||Object} 有效的actionName，无效me.findActionName会报错
         */
        getActionInstance: function (actionName) {
            var action = this.getActionConstructor(actionName);
            /*
            // 注: 注释原因是 [找到匹配的路径规则(该过程中会创建action实例)]过程中的me.findActionName(loc)已作处理
            if (!action && hui.window.console && hui.window.console.error) {
                hui.window.console.error('Action clazz \''+actionName+'\' not exist.');
            }*/

            if (action instanceof Function) {
                action = this.getExtClass('hui.Action').getByActionName(action) || new action();
            }

            return action;
        },
        /**
         * @name 解析获取到的location字符串
         * @private
         * @param {Object} loc
         */
        parseLocator: function (url) {
            url = url === null || url === undefined ? window.location.href : String(url);
            var pair,
                query = {},
                loc = '',
                args = '',
                list,
                v,
                str = url.split('#'),
                href;

            if (~url.indexOf('?')) {
                // Parse ?aa=xxx
                pair = str[0].match(/^([^\?]*)(\?(.*))?$/);
                if (pair) {
                    //loc = pair[1];
                    args = (pair.length == 4 ? pair[3] : '') || '';
                }
                list = args ? args.split('&') : [];
                for (var i = 0, len = list.length; i < len; i++) {
                    v = list[i].split('=');
                    v.push('');
                    query[v[0]] = v[1];
                }
            }
            if (~url.indexOf('#') || str.length === 1) {
                href = str.length === 1 ? str[0] : str[1];
                // Parse #~bb=xxx
                pair = href.match(/^([^~]*)(~(.*))?$/);
                if (pair) {
                    loc = pair[1];
                    args = (pair.length == 4 ? pair[3] : '') || '';
                }
                list = args ? args.split('&') : [];
                for (var i = 0, len = list.length; i < len; i++) {
                    v = list[i].split('=');
                    v.push('');
                    query[v[0]] = v[1];
                }
            }

            return {
                'location': loc,
                'query': query
            };
        },
        /**
         * @name 初始化控制器,包括路由器和定位器locator
         * @protected
         * @param {String} rule 路径
         * @param {String} func 对应action
         */
        init: function () {
            //var me = this;
        },
        getExtClass: function (clazz) {
            var result = function () {};
            switch (clazz) {
                //me.getExtClass('hui.Mask')
            case 'hui.Mask':
                if (typeof hui !== 'undefined' && hui && hui.Mask) {
                    result = hui.Mask;
                }
                else {
                    result.showLoading = new Function();
                    result.hideLoading = new Function();
                }
                break;
                //me.getExtClass('hui.Locator')
            case 'hui.Locator':
                if (typeof hui !== 'undefined' && hui && hui.Locator) {
                    result = hui.Locator;
                }
                else {
                    result.redirect = new Function();
                }
                break;
                //me.getExtClass('hui.Action')
            case 'hui.Action':
                if (typeof hui !== 'undefined' && hui && hui.Action) {
                    result = hui.Action;
                }
                else {
                    result.getByActionName = new Function();
                }
                break;
                //me.getExtClass('hui.Router')
            case 'hui.Router':
                if (typeof hui !== 'undefined' && hui && hui.Router) {
                    result = hui.Router;
                }
                else {
                    result.findAction = new Function();
                }
                break;
            default:
            }
            return result;
        }
    };

    hui.Locator = {
        /**
         * @name 默认首次进入的路径.
         * @default '/'
         * @public
         */
        DEFAULT_INDEX: '/',
        /**
         * @name 当前路径.
         * @public
         */
        currentLocation: null,
        /**
         * @name 使用iframe兼容早期IE版本无法通过onhashchange保存浏览历史的问题.
         * @private
         */
        CONTROL_IFRAME_ID: 'ERHistroyRecordIframe' + String(Math.random()).replace('.', ''),
        IFRAME_CONTENT: '<html><head></head><body><input type="text" id="save">' + '<script type="text/javascript">' + 'var loc = "#{0}";' + 'document.getElementById("save").value = loc;' + 'parent.hui.Locator.updateLocation(loc);' + 'parent.hui.Locator.switchToLocation(loc);' + '<' + '/script ></body></html>',
        /**
         * @name 获取location信息
         * @private
         * @return {String}
         */
        getLocation: function () {
            var hash;

            // firefox下location.hash会自动decode
            // 体现在：
            //   * 视觉上相当于decodeURI，
            //   * 但是读取location.hash的值相当于decodeURIComponent
            // 所以需要从location.href里取出hash值
            if (/firefox\/(\d+\.\d+)/i.test(navigator.userAgent) ? +RegExp['\x241'] : undefined) {
                hash = location.href.match(/#(.*)$/);
                hash && (hash = hash[1]);
            }
            else {
                hash = location.hash;
            }

            if (hash) {
                return hash.replace(/^#/, '');
            }

            return '';
        },
        /**
         * @name 更新hash信息
         * @private
         * @param {String} loc
         */
        updateLocation: function (loc) {
            var me = this,
                isChange = (me.currentLocation != loc);

            // 存储当前信息
            // opera下，相同的hash重复写入会在历史堆栈中重复记录
            // 所以需要getLocation来判断
            if (me.currentLocation != loc && me.getLocation() != loc) {
                location.hash = loc;
            }

            me.currentLocation = loc;
            return isChange;
        },
        /**
         * @name 控制定位器转向
         * @public
         * @param {String} loc location位置
         * @param {Object} opt_option 转向参数
         */
        redirect: function (loc, opt_option) {
            var me = hui.Locator,
                opt = opt_option || {},
                hisList,
                histotry = document.getElementById('histotry');

            if (!hui.Locator.hisList) {
                hui.Locator.hisList = [];
            }
            hisList = hui.Locator.hisList;
            hisList.push(loc);

            if (histotry) {
                histotry.innerHTML = hisList.join('<br/>');
            }

            // 非string不做处理
            if (typeof loc != 'string') {
                return;
            }

            // 增加location带起始#号的容错性
            // 可能有人直接读取location.hash，经过string处理后直接传入
            loc = loc.replace(/^#/, '');

            // 空string当成DEFAULT_INDEX处理
            if (loc.length === 0) {
                loc = me.DEFAULT_INDEX;
            }

            // 与当前location相同时不进行route
            var isLocChanged = me.updateLocation(loc);
            if (isLocChanged || opt.enforce) {
                loc = me.currentLocation;

                // 触发onredirect事件
                me.onredirect(loc);

                // 当location未变化，强制刷新时，直接route
                if (isLocChanged === false) {
                    hui.Locator.switchToLocation(loc);
                }
                else {
                    // location被改变了,非强制跳转
                    me.doRoute(loc);
                }
            }
        },
        /**
         * @name 权限判断以及重定向
         * @private
         * @param {String} loc location位置
         */
        doRoute: function (loc) {
            var me = this;
            // 权限判断以及转向
            var loc302 = me.authorize(loc);
            if (loc302) {
                me.redirect(loc302);
                return;
            }

            // ie下使用中间iframe作为中转控制
            // 其他浏览器直接调用控制器方法
            var ie = /msie (\d+\.\d+)/i.test(navigator.userAgent) ? (document.documentMode || +RegExp['\x241']) : undefined;
            if (ie && ie < 8) {
                me.ieRoute(loc);
            }
            else {
                me.switchToLocation(loc);
            }
        },
        /**
         * @name Location变化调用接口
         * @public
         */
        switchToLocation: function (url) {
            var me = this,
                action,
                loc = url;
            // Check url whether illegal.
            if (hui.Router && hui.Router.findAction) {
                // hui.Master.parseLocator(url)
                if (hui.Master && hui.Master.parseLocator) {
                    loc = hui.Master.parseLocator(url);
                    loc = loc ? loc.location : url;
                }
                action = hui.Router.findAction(loc);
                url = action ? url : '/404';
            }
            // checkRouter的过程中可能会改变url
            if (hui.Locator.checkRouter) {
                hui.Locator.checkRouter(url, hui.fn(me.callMasterForward, me));
            }
            else {
                me.callMasterForward(url);
            }
        },
        /**
         * @name 解析获取到的location字符串
         * @private
         * @param {Object} loc
         *
        // 注: 放在Master是因为可能用户会直接使用url而非hashchange来跳转!
        parseLocator: function(url) {...},*/
        /**
         * @name 调用Master的forward接口 注：forward接口不推荐外部直接调用!!
         * @private
         */
        callMasterForward: function (url) {
            if (typeof hui != 'undefined' && hui.Master && hui.Master.forward) {
                hui.Master.forward(url);
            }
        },
        /**
         * @name onredirect事件外部接口
         * @interface
         * @public
         */
        'onredirect': new Function(),
        /**
         * @name 强制刷新当前地址
         * @method
         * @public
         */
        'reload': function () {
            var me = this;
            if (me.currentLocation) {
                me.redirect(me.currentLocation, {
                    enforce: true
                });
            }
        },
        /**
         * @name IE下调用router
         * @method
         * @private
         * @param {String} loc 地址, iframe内容字符串的转义
         */
        ieRoute: function (loc) {
            var me = this;
            var iframe = document.getElementById(me.CONTROL_IFRAME_ID),
                iframeDoc = iframe.contentWindow.document;

            iframeDoc.open('text/html');
            iframeDoc.write(
                me.IFRAME_CONTENT.replace('#{0}',
                    String(loc).replace(/\\/g, '\\\\').replace(/\"/g, '\\"'))); //'
            iframeDoc.close();

        },
        /**
         * @name 初始化locator
         * @public
         */
        init: function () {
            var me = this,
                ie = /msie (\d+\.\d+)/i.test(navigator.userAgent) ? (document.documentMode || +RegExp['\x241']) : undefined;
            if (ie && ie < 8) {
                me.ieCreateIframeRecorder();
                window.setInterval(function () {
                    me.changeListener();
                }, 100);
            }
            else if ('onhashchange' in window) {
                window.onhashchange = function (args) {
                    me.changeListener(args);
                };
                me.changeListener();
            }
            else {
                window.setInterval(function () {
                    me.changeListener();
                }, 100);
            }
        },
        /**
         * @name hash变化的事件监听器
         * @method
         * @private
         */
        changeListener: function () {
            var me = this,
                loc = me.getLocation();

            if (!loc && !me.currentLocation) {
                me.redirect(me.DEFAULT_INDEX);
            }
            else if (loc && me.updateLocation(loc)) {
                me.doRoute(loc);
            }
        },
        /**
         * @name ie下创建记录与控制跳转的iframe
         * @method
         * @private
         */
        ieCreateIframeRecorder: function () {
            var me = this;
            var iframe = document.createElement('iframe'),
                size = 200,
                pos = '-1000px';

            iframe.id = me.CONTROL_IFRAME_ID;
            iframe.width = size;
            iframe.height = size;
            iframe.src = 'about:blank';

            iframe.style.position = 'absolute';
            iframe.style.top = pos;
            iframe.style.left = pos;

            document.documentElement.appendChild(iframe);
        },
        /**
         * @name 路径权限规则列表
         * @property
         * @type {Array}
         * @default []
         * @public
         */
        authorizers: [],
        /**
         * @name 增加权限验证器
         * @method
         * @public
         * @param {Function} authorizer 验证器，验证失败时验证器返回转向地址
         */
        addAuthorizer: function (authorizer) {
            var me = this;
            if ('function' == typeof authorizer) {
                me.authorizers.push(authorizer);
            }
        },
        /**
         * @name 权限验证
         * @method
         * @private
         * @return {String} 验证失败时验证器返回转向地址
         */
        authorize: function (currLoc) {
            var me = this,
                loc,
                i,
                len = me.authorizers.length;

            for (i = 0; i < len; i++) {
                loc = me.authorizers[i](currLoc);
                if (loc) {
                    return loc;
                }
            }
        }
    };

    /**
     * @name 预处理流程
     * @public
     * @author wanghaiyang
     * @date 2014/05/05
     */
    hui.Action.start = function () {
        var que = new hui.Flow();

        /**
         * @name before事件外部接口
         * @public
         */
        if (hui.beforeinit) {
            que.push(hui.beforeinit);
        }
        /**
         * @name 载入预定义模板文件
         * @private
         */
        if (hui.Template && hui.Template.loadAllTemplate && hui.Template.TEMPLATE_LIST) {
            que.push(function (callback) {
                hui.Template.onload = callback;
                hui.Template.loadAllTemplate();
            });
        }

        que.push(hui.Template.finishLoad);
        /**
         * @name afterinit事件外部接口，在hui.Template.finishLoad之后执行
         * @public
         */
        if (hui.Action.afterStart) {
            que.push(hui.Action.afterStart);
        }

        que.next();
    };

    hui.Action.afterStart = function (callback) {
        // Todo
        callback();
    };

    /**
     * @name 模板载入完毕之后,初始化路由列表,启动location侦听
     * @private
     */
    hui.Template.finishLoad = function (callback) {
        callback && callback();

        // 1.防止onload再次执行
        if (hui.Template) {
            hui.Template.loadedCount = -100000;
            delete hui.Template.loadedCount;
        }

        // 2.初始化路由列表
        if (hui.Router && hui.Router.init) {
            hui.Router.init();
        }
        // 3.启动location侦听
        if (hui.Locator && hui.Locator.init) {
            // 默认首次进入的路径
            hui.Locator.init();
        }
    };

    /*============================================
     * 404 page
     ============================================*/
    var page404;
    page404 = function () {
        hui.Action.call(this);
        /**
         * @name Action索引ID
         * @comment 主要用于控件中通过onclick="hui.Control.getById('listTable','login');
         */
        this.id = 'page404';
        // 初始化数据模型
        // 使用了getView这里可以不用设置view属性
        // this.view = 'page404';
        // 初始化数据模型
        var baseModel = hui.Action.getExtClass('hui.BaseModel');
        this.model = new baseModel();
    };

    page404.prototype = {
        getView: function () {
            var str = hui.Control.format('<div style="font-size:10pt;line-height:1.2em; line-height: 1.2em;padding: 15px;text-align: left;"><h3 style="margin:0px;line-height:3em;">The page cannot be found</h3>' + '<p>The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.</p>' + '<p>Please try the following:</p>' + '<ul><li>If you typed the page address in the Address bar, make sure that it is spelled correctly.<br/></li>' + '<li>Open the <a href="#/">home page</a>, and then look for links to the information you want.</li>' + '<li>Click the <a href="javascript:history.go(-1)">Back</a> button to try another link. </li>' + '</ul><p><br></p>HTTP 404 - File not found<br />Need any help? Please contact the Monsieur #{name}.<br /></div>', this.args);
            return str;
        },
        initModel: function (callback) {
            //var me = this;
            //me.model.set('free', 'not free');
            callback && callback();
        },
        render: function () {
            //var me = this;
            /*Requester.get('/mockup/user.json', {onsuccess:function(err, data){
                me.setInnerHTML(me, hui.Control.format(me.getInnerHTML(), {name: data.result}));
            }});*/
        },
        /**
         * @name 初始化列表行为
         * @param {Object} controlMap 当前主内容区域绘制的控件集合.
         */
        initBehavior: function () {
            //var me = this;

        }
    };

    hui.inherits(page404, hui.Action);
    hui.Router.setRule('/404', 'page404');

    hui.window.page404 = page404;
});