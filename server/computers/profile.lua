local config = require 'configs.config'

local store = require 'server.computers.store'

local text = require 'shared.text'

local profile = {}

local MAX_NOTES = 50

local MAX_TITLE, MAX_BODY = 80, 20000

local WALLPAPERS = {}
for style, def in pairs(config.Desktop.Styles or {}) do
    WALLPAPERS[style] = {}
    for _, w in ipairs(def.Wallpapers or {}) do WALLPAPERS[style][w.id] = true end
end

local function sanitize(t, style)
    if type(t) ~= 'table' then return {} end
    local out = {}
    if t.theme == 'dark' or t.theme == 'light' then out.theme = t.theme end
    if type(t.wallpaper) == 'string' then
        local w = t.wallpaper
        local known = WALLPAPERS[style] or {}
        if known[w] or (#w <= 512 and (w:match('^https://') or w:match('^nui://'))) then out.wallpaper = w end
    end
    if type(t.accent) == 'string' and t.accent:match('^#%x%x%x%x%x%x$') then out.accent = t.accent:lower() end
    if style == 'modern' then
        for _, key in ipairs({ 'taskbarPins', 'desktopHidden' }) do
            if type(t[key]) == 'table' then
                out[key] = {}
                local count = 0
                for app, value in pairs(t[key]) do
                    if type(app) == 'string' and #app <= 128 and app:match('^[%w_:%-]+$') and type(value) == 'boolean' then
                        out[key][app] = value
                        count = count + 1
                        if count >= 256 then break end
                    end
                end
            end
        end
        if type(t.desktopPositions) == 'table' then
            out.desktopPositions = {}
            local count = 0
            for app, pos in pairs(t.desktopPositions) do
                if type(app) == 'string' and #app <= 128 and app:match('^[%w_:%-]+$') and type(pos) == 'table'
                    and type(pos.col) == 'number' and type(pos.row) == 'number'
                    and pos.col >= 0 and pos.col <= 255 and pos.col % 1 == 0
                    and pos.row >= 0 and pos.row <= 255 and pos.row % 1 == 0 then
                    out.desktopPositions[app] = { col = pos.col, row = pos.row }
                    count = count + 1
                    if count >= 256 then break end
                end
            end
        end
    end
    return out
end

local function allSettings(citizenid)
    local raw = store.getProfile(citizenid)
    local t = raw and json.decode(raw)
    if type(t) ~= 'table' then return {} end
    if t.theme or t.wallpaper or t.accent then return { modern = { theme = t.theme, wallpaper = t.wallpaper, accent = t.accent } } end
    return t
end

function profile.settings(citizenid, style)
    return sanitize(allSettings(citizenid)[style], style)
end

function profile.saveSettings(citizenid, style, patch)
    local all = allSettings(citizenid)
    local merged = sanitize(all[style], style)
    for k, v in pairs(sanitize(patch, style)) do merged[k] = v end
    all[style] = merged
    store.setSettings(citizenid, json.encode(all))
    return merged
end

function profile.notes(citizenid)
    local _, raw = store.getProfile(citizenid)
    local list = raw and json.decode(raw)
    if type(list) ~= 'table' then return {} end
    table.sort(list, function(a, b) return (a.updatedAt or 0) > (b.updatedAt or 0) end)
    return list
end

function profile.saveNote(citizenid, note)
    if type(note) ~= 'table' then return nil, 'err.invalid' end
    local title = text.clip(note.title, MAX_TITLE)
    local body = text.clip(note.body, MAX_BODY)
    if title == '' then title = 'Untitled' end

    local list = profile.notes(citizenid)
    local saved
    for _, n in ipairs(list) do
        if note.id ~= nil and n.id == note.id then
            n.title, n.body, n.updatedAt = title, body, os.time()
            saved = n
            break
        end
    end
    if not saved then
        if #list >= MAX_NOTES then return nil, 'err.notes_full' end
        saved = { id = ('%x%04x'):format(os.time(), math.random(0, 0xFFFF)), title = title, body = body, updatedAt = os.time() }
        list[#list + 1] = saved
    end
    store.setNotes(citizenid, json.encode(list))
    return saved, nil
end

function profile.deleteNote(citizenid, id)
    local list, kept = profile.notes(citizenid), {}
    for _, n in ipairs(list) do
        if n.id ~= id then kept[#kept + 1] = n end
    end
    store.setNotes(citizenid, json.encode(kept))
end

return profile
