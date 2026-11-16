local config = require 'configs.config'

local rpc = require 'server.computers.rpc'

local session = require 'server.computers.session'

local logs = require 'server.computers.logs'

local profile = require 'server.computers.profile'

local registry = require 'server.computers.registry'

local cameras = require 'server.computers.cameras'

local printing = require 'server.computers.printing'

local custom = require 'server.computers.apps'

rpc.register('shell:launch', nil, function(_, s, payload)
    local app = payload.app
    if type(app) ~= 'string' or not s.apps[app] then return rpc.ok() end
    if config.Logs and config.Logs.AppLaunch ~= false then
        local ext = app:sub(1, #custom.PREFIX) == custom.PREFIX and custom.get(app) or nil
        local label = ext and ext.label or config.Desktop.Apps[app] and config.Desktop.Apps[app].label or app
        logs.write(s.instance, {
            level = 'information', source = 'Shell', eventId = logs.EVENT.APP_START,
            message = locale('logs.app_start', label, s.name),
        }, session.actor(s))
    end
    return rpc.ok()
end)

rpc.register('profile:save', nil, function(_, s, payload)
    return rpc.ok(profile.saveSettings(s.citizenid, s.style, payload.settings))
end)

rpc.register('notes:list', 'notepad', function(_, s)
    return rpc.ok(profile.notes(s.citizenid))
end)

rpc.register('notes:save', 'notepad', function(_, s, payload)
    local note, err = profile.saveNote(s.citizenid, payload.note)
    if not note then return rpc.fail(err or 'err.invalid') end
    return rpc.ok(note)
end)

rpc.register('notes:delete', 'notepad', function(_, s, payload)
    if type(payload.id) == 'string' then profile.deleteNote(s.citizenid, payload.id) end
    return rpc.ok()
end)

local function canClear(src)
    local L = config.Logs or {}
    if L.AllowClear == false then return false end
    return session.inGroups(src, L.ClearGroups)
end

rpc.register('logs:page', 'logs', function(src, s, payload)
    local page = logs.page(s.instance, payload.filter)
    page.canClear = canClear(src)
    page.computer = { hostname = s.hostname, label = s.def.label or s.def.id }
    return rpc.ok(page)
end)

printing.source('logs', 'logs', function(_, s, payload)
    local page = logs.page(s.instance, payload.filter)
    local rows = {}
    for i, e in ipairs(page.entries) do
        if i > 60 then break end
        rows[i] = { os.date('%d/%m/%Y %H:%M:%S', tonumber(e.ts) or 0), tostring(e.level or ''), tostring(e.source or ''), tostring(e.event_id or ''), tostring(e.message or '') }
    end
    if #rows == 0 then return nil, locale('print.logs_empty') end
    return {
        kind = 'logs', title = locale('print.logs_title', s.hostname), letterhead = locale('print.logs_head'), subhead = s.def.label or s.def.id,
        fields = {
            { label = locale('print.logs_computer'), value = s.hostname },
            { label = locale('print.logs_entries'), value = tostring(#rows) },
            { label = locale('print.logs_date'), value = os.date('%d/%m/%Y %H:%M') },
        },
        table = { head = { locale('print.col_time'), locale('print.col_level'), locale('print.col_source'), locale('print.col_event'), locale('print.col_message') }, rows = rows },
    }
end)

rpc.register('logs:clear', 'logs', function(src, s)
    if not canClear(src) then return rpc.fail('err.no_access') end
    logs.clear(s.instance, session.actor(s))
    return rpc.ok()
end)

rpc.register('cmd:sysinfo', 'cmd', function(_, s)
    local c = s.coords
    local mac = ('%02X-%02X-%02X-%02X-%02X-%02X'):format(0x00, 0x1A, math.floor(c.x) & 0xFF, math.floor(c.y) & 0xFF, math.floor(c.z) & 0xFF, #s.instance & 0xFF)
    return rpc.ok({
        hostname = s.hostname, ip = s.ip, mac = mac, label = s.def.label or s.def.id,
        user = s.name, domain = (s.def.groups and next(s.def.groups)) and tostring(next(s.def.groups)):upper() or 'WORKGROUP',
        os = registry.styleDef(s.style).OsName or s.style, build = registry.styleDef(s.style).OsBuild or '1.0', uptime = os.time() - s.openedAt,
    })
end)

rpc.register('cameras:list', 'cameras', function(src, s)
    local out = {}
    for _, cam in ipairs(cameras.visible(src, s.def)) do
        out[#out + 1] = { id = cam.id, label = cam.label, area = cam.area }
    end
    return rpc.ok(out)
end)

rpc.register('cameras:watch', 'cameras', function(src, s, payload)
    for _, cam in ipairs(cameras.visible(src, s.def)) do
        if cam.id == payload.id then
            s.watched = s.watched or {}
            if not s.watched[cam.id] then
                s.watched[cam.id] = true
                logs.write(s.instance, {
                    level = 'information', source = 'Cameras', eventId = logs.EVENT.CAMERA_VIEW,
                    message = locale('logs.camera_view', s.name, cam.label), data = { camera = cam.id },
                }, session.actor(s))
            end
            local limits = cameras.limits()
            return rpc.ok({
                id = cam.id, label = cam.label, area = cam.area,
                x = cam.x, y = cam.y, z = cam.z, pitch = cam.pitch, roll = cam.roll, yaw = cam.yaw, fov = cam.fov,
                pan = limits.pan, tilt = limits.tilt, zoom = limits.zoom, filter = limits.filter,
            })
        end
    end
    return rpc.fail('cameras.err_unknown')
end)

return {}
