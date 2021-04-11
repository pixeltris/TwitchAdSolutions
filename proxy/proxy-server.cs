using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Runtime.Serialization;
using System.Reflection;
using System.Threading;
using System.Net;
using System.Net.Sockets;
using System.IO;
using System.Diagnostics;
using System.Threading.Tasks;

class TwitchProxyServer
{
    private static string ClientID = "kimne78kx3ncx6brgo4mv6wki5h1ko";
    private static string UserAgentChrome = "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36";
    private static string UserAgentFirefox = "Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:84.0) Gecko/20100101 Firefox/84.0";
    private static string UserAgent = UserAgentChrome;
    private static string Platform = "web";
    private static string PlayerBackend = "mediaplayer";
    private static string playerType = "site";
    private static bool UseFastBread = true;// fast_bread (EXT-X-TWITCH-PREFETCH)
    private static DeviceIdType deviceIdType = DeviceIdType.Normal;
    private Thread thread;
    private HttpListener listener;
    private string deviceId;
    
    private static bool SocksProxyFound { get { return !string.IsNullOrEmpty(SocksProxyIP) && SocksProxyPort > 0; } }
    private static string SocksProxyIP;
    private static int SocksProxyPort;
    private static string SocksProxyUser;
    private static string SocksProxyPass;
    private static MihaZupan.HttpToSocks5Proxy proxy = null;
    
    enum DeviceIdType
    {
        Normal,
        Empty,
        None,
        Unique
    }

    public static void Run()
    {
        try
        {
            string file = "proxy-server-info.txt";
            if (File.Exists(file))
            {
                string[] lines = File.ReadAllLines(file);
                if (lines.Length > 1)
                {
                    SocksProxyIP = lines[0].Trim();
                    if (!string.IsNullOrWhiteSpace(lines[1]))
                    {
                        SocksProxyPort = int.Parse(lines[1].Trim());
                    }
                    if (lines.Length > 2)
                    {
                        SocksProxyUser = lines[2].Trim();
                    }
                    if (lines.Length > 3)
                    {
                        SocksProxyPass = lines[3].Trim();
                    }
                    if (SocksProxyPort > 0)
                    {
                        if (!string.IsNullOrWhiteSpace(SocksProxyUser))
                        {
                            proxy = new MihaZupan.HttpToSocks5Proxy(SocksProxyIP, SocksProxyPort, SocksProxyUser, SocksProxyPass);
                        }
                        else
                        {
                            proxy = new MihaZupan.HttpToSocks5Proxy(SocksProxyIP, SocksProxyPort);
                        }
                    }
                }
            }
        }
        catch (Exception e)
        {
            Console.WriteLine(e);
            SocksProxyIP = null;
            SocksProxyPort = 0;
        }
        Console.WriteLine("Socks: " + SocksProxyFound);
        
        ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072;
        TwitchProxyServer server = new TwitchProxyServer();
        server.Start();
        System.Diagnostics.Process.GetCurrentProcess().WaitForExit();
    }

    public void Start()
    {
        Stop();

        thread = new Thread(delegate()
        {
            listener = new HttpListener();
            listener.Prefixes.Add("http://*:" + 80 + "/");
            listener.Start();
            while (listener != null)
            {
                try
                {
                    HttpListenerContext context = listener.GetContext();
                    Process(context);
                }
                catch
                {
                }
            }
        });
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
    }

    public void Stop()
    {
        if (listener != null)
        {
            try
            {
                listener.Stop();
            }
            catch
            {
            }
            listener = null;
        }

        if (thread != null)
        {
            try
            {
                thread.Abort();
            }
            catch
            {
            }
            thread = null;
        }
    }
    
    private void Process(HttpListenerContext context)
    {
        try
        {
            string url = context.Request.Url.OriginalString;
            Console.WriteLine("req " + DateTime.Now.TimeOfDay + " - " + url);

            byte[] responseBuffer = null;
            string response = string.Empty;
            string contentType = "text/html";

            if (url.Contains("favicon.ico"))
            {
                context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
                context.Response.OutputStream.Close();
                return;
            }

            if (context.Request.Url.Segments.Length > 2 &&
                context.Request.Url.Segments[1].Trim('/') == "twitch-m3u8" &&
                !string.IsNullOrEmpty(context.Request.Url.Segments[2]))
            {
                string channelName = context.Request.Url.Segments[2].Trim('/');
                response = FetchM3U8(channelName);
                //Console.WriteLine(response);
            }

            if (responseBuffer == null)
            {
                responseBuffer = Encoding.UTF8.GetBytes(response.ToString());
            }
            context.Response.Headers["Access-Control-Allow-Origin"] = "*";
            context.Response.ContentType = contentType;
            context.Response.ContentEncoding = Encoding.UTF8;
            context.Response.ContentLength64 = responseBuffer.Length;
            context.Response.OutputStream.Write(responseBuffer, 0, responseBuffer.Length);
            context.Response.OutputStream.Flush();
            context.Response.StatusCode = (int)HttpStatusCode.OK;
        }
        catch
        {
            context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
        }

        context.Response.OutputStream.Close();
    }
    
    private string FetchM3U8(string channel)
    {
        if (string.IsNullOrEmpty(deviceId) || deviceIdType == DeviceIdType.Unique)
        {
            UpdateDeviceId(channel);
        }
        using (WebClient wc = new WebClient())
        {
            string response = null, token = null, sig = null;
            wc.Proxy = proxy;
            wc.Headers.Clear();
            wc.Headers["client-id"] = ClientID;
            if (deviceIdType != DeviceIdType.None)
            {
                wc.Headers["Device-ID"] = deviceIdType == DeviceIdType.Empty ? string.Empty : deviceId;
            }
            wc.Headers["accept"] = "*/*";
            wc.Headers["accept-encoding"] = "gzip, deflate, br";
            wc.Headers["accept-language"] = "en-us";
            wc.Headers["content-type"] = "text/plain; charset=UTF-8";
            wc.Headers["origin"] = "https://www.twitch.tv";
            wc.Headers["referer"] = "https://www.twitch.tv/";
            wc.Headers["user-agent"] = UserAgent;
            response = wc.UploadString("https://gql.twitch.tv/gql", @"{""operationName"":""PlaybackAccessToken_Template"",""query"":""query PlaybackAccessToken_Template($login: String!, $isLive: Boolean!, $vodID: ID!, $isVod: Boolean!, $playerType: String!) {  streamPlaybackAccessToken(channelName: $login, params: {platform: \""" + Platform + @"\"", playerBackend: \""" + PlayerBackend + @"\"", playerType: $playerType}) @include(if: $isLive) {    value    signature    __typename  }  videoPlaybackAccessToken(id: $vodID, params: {platform: \""" + Platform + @"\"", playerBackend: \""" + PlayerBackend + @"\"", playerType: $playerType}) @include(if: $isVod) {    value    signature    __typename  }}"",""variables"":{""isLive"":true,""login"":""" + channel + @""",""isVod"":false,""vodID"":"""",""playerType"":""" + playerType + @"""}}");
            if (!string.IsNullOrEmpty(response))
            {
                TwitchAccessToken tokenInfo = JSONSerializer<TwitchAccessToken>.DeSerialize(response);
                if (tokenInfo != null && tokenInfo.data != null && tokenInfo.data.streamPlaybackAccessToken != null &&
                    !string.IsNullOrEmpty(tokenInfo.data.streamPlaybackAccessToken.value) && !string.IsNullOrEmpty(tokenInfo.data.streamPlaybackAccessToken.signature))
                {
                    token = tokenInfo.data.streamPlaybackAccessToken.value;
                    sig = tokenInfo.data.streamPlaybackAccessToken.signature;
                }
            }
            if (!string.IsNullOrEmpty(token))
            {
                string additionalParams = "";
                if (UseFastBread)
                {
                    additionalParams += "&fast_bread=true";
                }
                string url = "https://usher.ttvnw.net/api/channel/hls/" + channel + ".m3u8?allow_source=true" + additionalParams + "&sig=" + sig + "&token=" + System.Web.HttpUtility.UrlEncode(token);
                wc.Headers.Clear();
                wc.Headers["accept"] = "application/x-mpegURL, application/vnd.apple.mpegurl, application/json, text/plain";
                wc.Headers["host"] = "usher.ttvnw.net";
                wc.Headers["cookie"] = "DNT=1;";
                wc.Headers["DNT"] = "1";
                wc.Headers["user-agent"] = UserAgent;
                string encodingsM3u8 = wc.DownloadString(url);
                return encodingsM3u8;
            }
        }
        return null;
    }
    
    private void UpdateDeviceId(string channel)
    {
        using (CookieAwareWebClient wc = new CookieAwareWebClient())
        {
            wc.Proxy = null;
            wc.Headers["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9";
            wc.DownloadString("https://www.twitch.tv/" + channel);
            ProcessCookies(wc.Cookies, out deviceId);
            Console.WriteLine("deviceId: " + deviceId);
        }
    }
    
    static string ProcessCookies(string str)
    {
        string uniqueId;
        return ProcessCookies(str, out uniqueId);
    }
    
    static string ProcessCookies(string str, out string uniqueId)
    {
        uniqueId = null;
        string result = string.Empty;
        string[] cookies = str.Split(',');
        foreach (string cookie in cookies)
        {
            if (cookie.Split(';')[0].Contains('='))
            {
                string[] splitted = cookie.Split(';')[0].Split('=');
                if (splitted.Length >= 2 && splitted[0] == "unique_id")
                {
                    uniqueId = splitted[1];
                }
                result += cookie.Split(';')[0] + ";";
            }
        }
        return result;
    }
    
    class CookieAwareWebClient : WebClient
    {
        public CookieContainer CookieContainer { get; set; }
        public Uri Uri { get; set; }

        public string Cookies { get; private set; }

        public CookieAwareWebClient()
            : this(new CookieContainer())
        {
        }

        public CookieAwareWebClient(CookieContainer cookies)
        {
            this.CookieContainer = new CookieContainer();
        }

        protected override WebResponse GetWebResponse(WebRequest request)
        {
            WebResponse response = base.GetWebResponse(request);
            string setCookieHeader = response.Headers.Get("Set-Cookie");
            Cookies = setCookieHeader;
            return response;
        }
    }
    
    [DataContract]
    public class TwitchAccessTokenOld
    {
        [DataMember]
        public string token { get; set; }
        [DataMember]
        public string sig { get; set; }        
    }

    [DataContract]
    public class TwitchAccessToken
    {
        [DataMember]
        public TwitchAccessToken_data data { get; set; }
    }

    [DataContract]
    public class TwitchAccessToken_data
    {
        [DataMember]
        public TwitchAccessToken_streamPlaybackAccessToken streamPlaybackAccessToken { get; set; }
    }

    [DataContract]
    public class TwitchAccessToken_streamPlaybackAccessToken
    {
        [DataMember]
        public string value { get; set; }
        [DataMember]
        public string signature { get; set; }
    }
    
    static class JSONSerializer<TType> where TType : class
    {
        public static TType DeSerialize(string json)
        {
            return TinyJson.JSONParser.FromJson<TType>(json);
        }
    }
    
    static void Main()
    {
        TwitchProxyServer.Run();
    }
}

namespace TinyJson
{
    // Really simple JSON parser in ~300 lines
    // - Attempts to parse JSON files with minimal GC allocation
    // - Nice and simple "[1,2,3]".FromJson<List<int>>() API
    // - Classes and structs can be parsed too!
    //      class Foo { public int Value; }
    //      "{\"Value\":10}".FromJson<Foo>()
    // - Can parse JSON without type information into Dictionary<string,object> and List<object> e.g.
    //      "[1,2,3]".FromJson<object>().GetType() == typeof(List<object>)
    //      "{\"Value\":10}".FromJson<object>().GetType() == typeof(Dictionary<string,object>)
    // - No JIT Emit support to support AOT compilation on iOS
    // - Attempts are made to NOT throw an exception if the JSON is corrupted or invalid: returns null instead.
    // - Only public fields and property setters on classes/structs will be written to
    //
    // Limitations:
    // - No JIT Emit support to parse structures quickly
    // - Limited to parsing <2GB JSON files (due to int.MaxValue)
    // - Parsing of abstract classes or interfaces is NOT supported and will throw an exception.
    public static class JSONParser
    {
        [ThreadStatic] static Stack<List<string>> splitArrayPool;
        [ThreadStatic] static StringBuilder stringBuilder;
        [ThreadStatic] static Dictionary<Type, Dictionary<string, FieldInfo>> fieldInfoCache;
        [ThreadStatic] static Dictionary<Type, Dictionary<string, PropertyInfo>> propertyInfoCache;

        public static T FromJson<T>(this string json)
        {
            // Initialize, if needed, the ThreadStatic variables
            if (propertyInfoCache == null) propertyInfoCache = new Dictionary<Type, Dictionary<string, PropertyInfo>>();
            if (fieldInfoCache == null) fieldInfoCache = new Dictionary<Type, Dictionary<string, FieldInfo>>();
            if (stringBuilder == null) stringBuilder = new StringBuilder();
            if (splitArrayPool == null) splitArrayPool = new Stack<List<string>>();

            //Remove all whitespace not within strings to make parsing simpler
            stringBuilder.Length = 0;
            for (int i = 0; i < json.Length; i++)
            {
                char c = json[i];
                if (c == '"')
                {
                    i = AppendUntilStringEnd(true, i, json);
                    continue;
                }
                if (char.IsWhiteSpace(c))
                    continue;

                stringBuilder.Append(c);
            }

            //Parse the thing!
            return (T)ParseValue(typeof(T), stringBuilder.ToString());
        }

        static int AppendUntilStringEnd(bool appendEscapeCharacter, int startIdx, string json)
        {
            stringBuilder.Append(json[startIdx]);
            for (int i = startIdx + 1; i < json.Length; i++)
            {
                if (json[i] == '\\')
                {
                    if (appendEscapeCharacter)
                        stringBuilder.Append(json[i]);
                    stringBuilder.Append(json[i + 1]);
                    i++;//Skip next character as it is escaped
                }
                else if (json[i] == '"')
                {
                    stringBuilder.Append(json[i]);
                    return i;
                }
                else
                    stringBuilder.Append(json[i]);
            }
            return json.Length - 1;
        }

        //Splits { <value>:<value>, <value>:<value> } and [ <value>, <value> ] into a list of <value> strings
        static List<string> Split(string json)
        {
            List<string> splitArray = splitArrayPool.Count > 0 ? splitArrayPool.Pop() : new List<string>();
            splitArray.Clear();
            if (json.Length == 2)
                return splitArray;
            int parseDepth = 0;
            stringBuilder.Length = 0;
            for (int i = 1; i < json.Length - 1; i++)
            {
                switch (json[i])
                {
                    case '[':
                    case '{':
                        parseDepth++;
                        break;
                    case ']':
                    case '}':
                        parseDepth--;
                        break;
                    case '"':
                        i = AppendUntilStringEnd(true, i, json);
                        continue;
                    case ',':
                    case ':':
                        if (parseDepth == 0)
                        {
                            splitArray.Add(stringBuilder.ToString());
                            stringBuilder.Length = 0;
                            continue;
                        }
                        break;
                }

                stringBuilder.Append(json[i]);
            }

            splitArray.Add(stringBuilder.ToString());

            return splitArray;
        }

        internal static object ParseValue(Type type, string json)
        {
            if (type == typeof(string))
            {
                if (json.Length <= 2)
                    return string.Empty;
                StringBuilder parseStringBuilder = new StringBuilder(json.Length);
                for (int i = 1; i < json.Length - 1; ++i)
                {
                    if (json[i] == '\\' && i + 1 < json.Length - 1)
                    {
                        int j = "\"\\nrtbf/".IndexOf(json[i + 1]);
                        if (j >= 0)
                        {
                            parseStringBuilder.Append("\"\\\n\r\t\b\f/"[j]);
                            ++i;
                            continue;
                        }
                        if (json[i + 1] == 'u' && i + 5 < json.Length - 1)
                        {
                            UInt32 c = 0;
                            if (UInt32.TryParse(json.Substring(i + 2, 4), System.Globalization.NumberStyles.AllowHexSpecifier, null, out c))
                            {
                                parseStringBuilder.Append((char)c);
                                i += 5;
                                continue;
                            }
                        }
                    }
                    parseStringBuilder.Append(json[i]);
                }
                return parseStringBuilder.ToString();
            }
            if (type.IsPrimitive)
            {
                var result = Convert.ChangeType(json, type, System.Globalization.CultureInfo.InvariantCulture);
                return result;
            }
            if (type == typeof(decimal))
            {
                decimal result;
                decimal.TryParse(json, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out result);
                return result;
            }
            if (json == "null")
            {
                return null;
            }
            if (type.IsEnum)
            {
                if (json[0] == '"')
                    json = json.Substring(1, json.Length - 2);
                try
                {
                    return Enum.Parse(type, json, false);
                }
                catch
                {
                    return 0;
                }
            }
            if (type.IsArray)
            {
                Type arrayType = type.GetElementType();
                if (json[0] != '[' || json[json.Length - 1] != ']')
                    return null;

                List<string> elems = Split(json);
                Array newArray = Array.CreateInstance(arrayType, elems.Count);
                for (int i = 0; i < elems.Count; i++)
                    newArray.SetValue(ParseValue(arrayType, elems[i]), i);
                splitArrayPool.Push(elems);
                return newArray;
            }
            if (type.IsGenericType && type.GetGenericTypeDefinition() == typeof(List<>))
            {
                Type listType = type.GetGenericArguments()[0];
                if (json[0] != '[' || json[json.Length - 1] != ']')
                    return null;

                List<string> elems = Split(json);
                var list = (IList)type.GetConstructor(new Type[] { typeof(int) }).Invoke(new object[] { elems.Count });
                for (int i = 0; i < elems.Count; i++)
                    list.Add(ParseValue(listType, elems[i]));
                splitArrayPool.Push(elems);
                return list;
            }
            if (type.IsGenericType && type.GetGenericTypeDefinition() == typeof(Dictionary<,>))
            {
                Type keyType, valueType;
                {
                    Type[] args = type.GetGenericArguments();
                    keyType = args[0];
                    valueType = args[1];
                }

                //Refuse to parse dictionary keys that aren't of type string
                if (keyType != typeof(string))
                    return null;
                //Must be a valid dictionary element
                if (json[0] != '{' || json[json.Length - 1] != '}')
                    return null;
                //The list is split into key/value pairs only, this means the split must be divisible by 2 to be valid JSON
                List<string> elems = Split(json);
                if (elems.Count % 2 != 0)
                    return null;

                var dictionary = (IDictionary)type.GetConstructor(new Type[] { typeof(int) }).Invoke(new object[] { elems.Count / 2 });
                for (int i = 0; i < elems.Count; i += 2)
                {
                    if (elems[i].Length <= 2)
                        continue;
                    string keyValue = elems[i].Substring(1, elems[i].Length - 2);
                    object val = ParseValue(valueType, elems[i + 1]);
                    dictionary[keyValue] = val;
                }
                return dictionary;
            }
            if (type == typeof(object))
            {
                return ParseAnonymousValue(json);
            }
            if (json[0] == '{' && json[json.Length - 1] == '}')
            {
                return ParseObject(type, json);
            }

            return null;
        }

        static object ParseAnonymousValue(string json)
        {
            if (json.Length == 0)
                return null;
            if (json[0] == '{' && json[json.Length - 1] == '}')
            {
                List<string> elems = Split(json);
                if (elems.Count % 2 != 0)
                    return null;
                var dict = new Dictionary<string, object>(elems.Count / 2);
                for (int i = 0; i < elems.Count; i += 2)
                    dict[elems[i].Substring(1, elems[i].Length - 2)] = ParseAnonymousValue(elems[i + 1]);
                return dict;
            }
            if (json[0] == '[' && json[json.Length - 1] == ']')
            {
                List<string> items = Split(json);
                var finalList = new List<object>(items.Count);
                for (int i = 0; i < items.Count; i++)
                    finalList.Add(ParseAnonymousValue(items[i]));
                return finalList;
            }
            if (json[0] == '"' && json[json.Length - 1] == '"')
            {
                string str = json.Substring(1, json.Length - 2);
                return str.Replace("\\", string.Empty);
            }
            if (char.IsDigit(json[0]) || json[0] == '-')
            {
                if (json.Contains("."))
                {
                    double result;
                    double.TryParse(json, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out result);
                    return result;
                }
                else
                {
                    int result;
                    int.TryParse(json, out result);
                    return result;
                }
            }
            if (json == "true")
                return true;
            if (json == "false")
                return false;
            // handles json == "null" as well as invalid JSON
            return null;
        }

        static Dictionary<string, T> CreateMemberNameDictionary<T>(T[] members) where T : MemberInfo
        {
            Dictionary<string, T> nameToMember = new Dictionary<string, T>(StringComparer.OrdinalIgnoreCase);
            for (int i = 0; i < members.Length; i++)
            {
                T member = members[i];
                if (member.IsDefined(typeof(IgnoreDataMemberAttribute), true))
                    continue;

                string name = member.Name;
                if (member.IsDefined(typeof(DataMemberAttribute), true))
                {
                    DataMemberAttribute dataMemberAttribute = (DataMemberAttribute)Attribute.GetCustomAttribute(member, typeof(DataMemberAttribute), true);
                    if (!string.IsNullOrEmpty(dataMemberAttribute.Name))
                        name = dataMemberAttribute.Name;
                }

                nameToMember.Add(name, member);
            }

            return nameToMember;
        }

        static object ParseObject(Type type, string json)
        {
            object instance = FormatterServices.GetUninitializedObject(type);

            //The list is split into key/value pairs only, this means the split must be divisible by 2 to be valid JSON
            List<string> elems = Split(json);
            if (elems.Count % 2 != 0)
                return instance;

            Dictionary<string, FieldInfo> nameToField;
            Dictionary<string, PropertyInfo> nameToProperty;
            if (!fieldInfoCache.TryGetValue(type, out nameToField))
            {
                nameToField = CreateMemberNameDictionary(type.GetFields(BindingFlags.Instance | BindingFlags.Public | BindingFlags.FlattenHierarchy));
                fieldInfoCache.Add(type, nameToField);
            }
            if (!propertyInfoCache.TryGetValue(type, out nameToProperty))
            {
                nameToProperty = CreateMemberNameDictionary(type.GetProperties(BindingFlags.Instance | BindingFlags.Public | BindingFlags.FlattenHierarchy));
                propertyInfoCache.Add(type, nameToProperty);
            }

            for (int i = 0; i < elems.Count; i += 2)
            {
                if (elems[i].Length <= 2)
                    continue;
                string key = elems[i].Substring(1, elems[i].Length - 2);
                string value = elems[i + 1];

                FieldInfo fieldInfo;
                PropertyInfo propertyInfo;
                if (nameToField.TryGetValue(key, out fieldInfo))
                    fieldInfo.SetValue(instance, ParseValue(fieldInfo.FieldType, value));
                else if (nameToProperty.TryGetValue(key, out propertyInfo))
                    propertyInfo.SetValue(instance, ParseValue(propertyInfo.PropertyType, value), null);
            }

            return instance;
        }
    }
}

// https://github.com/MihaZupan/HttpToSocks5Proxy/tree/f595aa19b000025ee53081b8607db29c26740afa
namespace MihaZupan
{
    enum AddressType
    {
        IPv4 = 1,
        DomainName = 3,
        IPv6 = 4
    }
    enum Authentication
    {
        NoAuthentication = 0,
        GSSAPI = 1,
        UsernamePassword = 2
    }
    enum Command
    {
        Connect = 1,
        Bind = 2,
        UdpAssociate = 3
    }
    enum SocketConnectionResult
    {
        OK = 0,
        GeneralSocksServerFailure = 1,
        ConnectionNotAllowedByRuleset = 2,
        NetworkUnreachable = 3,
        HostUnreachable = 4,
        ConnectionRefused = 5,
        TTLExpired = 6,
        CommandNotSupported = 7,
        AddressTypeNotSupported = 8,

        // Library specific
        InvalidRequest = int.MinValue,
        UnknownError,
        AuthenticationError,
        ConnectionReset,
        ConnectionError,
        InvalidProxyResponse
    }
    public interface IDnsResolver
    {
       IPAddress TryResolve(string hostname);
    }
    internal class DefaultDnsResolver : IDnsResolver
    {
        public IPAddress TryResolve(string hostname)
        {
            IPAddress result = null;
            if (IPAddress.TryParse(hostname, out result))
            {
                return result;
            }

            try
            {
                result = System.Net.Dns.GetHostAddresses(hostname).FirstOrDefault();
            }
            catch (SocketException)
            {
                // ignore
            }

            return result;
        }
    }
    internal static class ErrorResponseBuilder
    {
        public static string Build(SocketConnectionResult error, string httpVersion)
        {
            switch (error)
            {
                case SocketConnectionResult.AuthenticationError:
                    return httpVersion + "401 Unauthorized\r\n\r\n";

                case SocketConnectionResult.HostUnreachable:
                case SocketConnectionResult.ConnectionRefused:
                case SocketConnectionResult.ConnectionReset:
                    return string.Concat(httpVersion, "502 ", error.ToString(), "\r\n\r\n");

                default:
                    return string.Concat(httpVersion, "500 Internal Server Error\r\nX-Proxy-Error-Type: ", error.ToString(), "\r\n\r\n");
            }
        }
    }
    internal static class Helpers
    {
        public static SocketConnectionResult ToConnectionResult(this SocketException exception)
        {
            if (exception.SocketErrorCode == SocketError.ConnectionRefused)
                return SocketConnectionResult.ConnectionRefused;

            if (exception.SocketErrorCode == SocketError.HostUnreachable)
                return SocketConnectionResult.HostUnreachable;

            return SocketConnectionResult.ConnectionError;
        }

        public static bool ContainsDoubleNewLine(this byte[] buffer, int offset, int limit, out int endOfHeader)
        {
            const byte R = (byte)'\r';
            const byte N = (byte)'\n';

            bool foundOne = false;
            for (endOfHeader = offset; endOfHeader < limit; endOfHeader++)
            {
                if (buffer[endOfHeader] == N)
                {
                    if (foundOne)
                    {
                        endOfHeader++;
                        return true;
                    }
                    foundOne = true;
                }
                else if (buffer[endOfHeader] != R)
                {
                    foundOne = false;
                }
            }

            return false;
        }

        private static readonly string[] HopByHopHeaders = new string[]
        {
            // ref: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers
            "CONNECTION", "KEEP-ALIVE", "PROXY-AUTHENTICATE", "PROXY-AUTHORIZATION", "TE", "TRAILER", "TRANSFER-ENCODING", "UPGRADE"
        };
        public static bool IsHopByHopHeader(this string header)
        {
            return HopByHopHeaders.Contains(header, StringComparer.OrdinalIgnoreCase);
        }

        public static AddressType GetAddressType(string hostname)
        {
            IPAddress hostIP;
            if (IPAddress.TryParse(hostname, out hostIP))
            {
                if (hostIP.AddressFamily == AddressFamily.InterNetwork)
                {
                    return AddressType.IPv4;
                }
                else
                {
                    return AddressType.IPv6;
                }
            }
            return AddressType.DomainName;
        }
        public static void TryDispose(this Socket socket)
        {
            if (socket.Connected)
            {
                try
                {
                    socket.Shutdown(SocketShutdown.Send);
                }
                catch { }
            }
            try
            {
                socket.Close();
            }
            catch { }
        }
        public static void TryDispose(this SocketAsyncEventArgs saea)
        {
            try
            {
                saea.UserToken = null;
                saea.AcceptSocket = null;

                saea.Dispose();
            }
            catch { }
        }
    }
    public class ProxyInfo
    {
        /// <summary>
        /// Proxy server address
        /// </summary>
        public readonly string Hostname;
        /// <summary>
        /// Proxy server port
        /// </summary>
        public readonly int Port;

        /// <summary>
        /// Indicates whether credentials were provided for this <see cref="ProxyInfo"/>
        /// </summary>
        public readonly bool Authenticate = false;
        internal readonly byte[] AuthenticationMessage;

        public ProxyInfo(string hostname, int port)
        {
            if (string.IsNullOrEmpty(hostname)) throw new ArgumentNullException("hostname");
            if (port < 0 || port > 65535) throw new ArgumentOutOfRangeException("port");

            Hostname = hostname;
            Port = port;
        }
        public ProxyInfo(string hostname, int port, string username, string password)
            : this(hostname, port)
        {
            if (string.IsNullOrEmpty(username)) throw new ArgumentNullException("username");
            if (string.IsNullOrEmpty(password)) throw new ArgumentNullException("password");

            Authenticate = true;
            AuthenticationMessage = Socks5.BuildAuthenticationMessage(username, password);
        }
    }
    internal class SocketRelay
    {
        private SocketAsyncEventArgs RecSAEA, SendSAEA;
        private Socket Source, Target;
        private byte[] Buffer;

        public bool Receiving;
        private int Received;
        private int SendingOffset;

        public SocketRelay Other;
        private bool Disposed = false;
        private bool ShouldDispose = false;

        private SocketRelay(Socket source, Socket target)
        {
            Source = source;
            Target = target;
            Buffer = new byte[81920];
            RecSAEA = new SocketAsyncEventArgs()
            {
                UserToken = this
            };
            SendSAEA = new SocketAsyncEventArgs()
            {
                UserToken = this
            };
            RecSAEA.SetBuffer(Buffer, 0, Buffer.Length);
            SendSAEA.SetBuffer(Buffer, 0, Buffer.Length);
            RecSAEA.Completed += OnAsyncOperationCompleted;
            SendSAEA.Completed += OnAsyncOperationCompleted;
            Receiving = true;
        }

        private void OnCleanup()
        {
            if (Disposed)
                return;

            Disposed = ShouldDispose = true;

            Other.ShouldDispose = true;
            Other = null;

            Source.TryDispose();
            Target.TryDispose();
            RecSAEA.TryDispose();
            SendSAEA.TryDispose();

            Source = Target = null;
            RecSAEA = SendSAEA = null;
            Buffer = null;
        }

        private void Process()
        {
            try
            {
                while (true)
                {
                    if (ShouldDispose)
                    {
                        OnCleanup();
                        return;
                    }

                    if (Receiving)
                    {
                        Receiving = false;
                        SendingOffset = -1;

                        if (Source.ReceiveAsync(RecSAEA))
                            return;
                    }
                    else
                    {
                        if (SendingOffset == -1)
                        {
                            Received = RecSAEA.BytesTransferred;
                            SendingOffset = 0;

                            if (Received == 0)
                            {
                                ShouldDispose = true;
                                continue;
                            }
                        }
                        else
                        {
                            SendingOffset += SendSAEA.BytesTransferred;
                        }

                        if (SendingOffset != Received)
                        {
                            SendSAEA.SetBuffer(Buffer, SendingOffset, Received - SendingOffset);

                            if (Target.SendAsync(SendSAEA))
                                return;
                        }
                        else Receiving = true;
                    }
                }
            }
            catch
            {
                OnCleanup();
            }
        }

        private static void OnAsyncOperationCompleted(object _, SocketAsyncEventArgs saea)
        {
            var relay = saea.UserToken as SocketRelay;
            relay.Process();
        }

        public static void RelayBiDirectionally(Socket s1, Socket s2)
        {
            var relayOne = new SocketRelay(s1, s2);
            var relayTwo = new SocketRelay(s2, s1);

            relayOne.Other = relayTwo;
            relayTwo.Other = relayOne;

            Task.Run(new Action(relayOne.Process));
            Task.Run(new Action(relayTwo.Process));
        }
    }
    internal static class Socks5
    {
        public static SocketConnectionResult TryCreateTunnel(Socket socks5Socket, string destAddress, int destPort, ProxyInfo proxy, IDnsResolver dnsResolver = null)
        {
            try
            {
                // SEND HELLO
                socks5Socket.Send(BuildHelloMessage(proxy.Authenticate));

                // RECEIVE HELLO RESPONSE - HANDLE AUTHENTICATION
                byte[] buffer = new byte[255];
                if (socks5Socket.Receive(buffer) != 2)
                    return SocketConnectionResult.InvalidProxyResponse;
                if (buffer[0] != SocksVersion)
                    return SocketConnectionResult.InvalidProxyResponse;
                if (buffer[1] == (byte)Authentication.UsernamePassword)
                {
                    if (!proxy.Authenticate)
                    {
                        // Proxy server is requesting UserPass auth even tho we did not allow it
                        return SocketConnectionResult.InvalidProxyResponse;
                    }
                    else
                    {
                        // We have to try and authenticate using the Username and Password
                        // https://tools.ietf.org/html/rfc1929
                        socks5Socket.Send(proxy.AuthenticationMessage);
                        if (socks5Socket.Receive(buffer) != 2)
                            return SocketConnectionResult.InvalidProxyResponse;
                        if (buffer[0] != SubnegotiationVersion)
                            return SocketConnectionResult.InvalidProxyResponse;
                        if (buffer[1] != 0)
                            return SocketConnectionResult.AuthenticationError;
                    }
                }
                else if (buffer[1] != (byte)Authentication.NoAuthentication)
                    return SocketConnectionResult.AuthenticationError;

                if (dnsResolver != null && Helpers.GetAddressType(destAddress) == AddressType.DomainName)
                {
                    var ipAddress = dnsResolver.TryResolve(destAddress);
                    if (ipAddress == null)
                    {
                        return SocketConnectionResult.HostUnreachable;
                    }

                    destAddress = ipAddress.ToString();
                }

                // SEND REQUEST
                socks5Socket.Send(BuildRequestMessage(Command.Connect, Helpers.GetAddressType(destAddress), destAddress, destPort));

                // RECEIVE RESPONSE
                int received = socks5Socket.Receive(buffer);
                if (received < 8)
                    return SocketConnectionResult.InvalidProxyResponse;
                if (buffer[0] != SocksVersion)
                    return SocketConnectionResult.InvalidProxyResponse;
                if (buffer[1] > 8)
                    return SocketConnectionResult.InvalidProxyResponse;
                if (buffer[1] != 0)
                    return (SocketConnectionResult)buffer[1];
                if (buffer[2] != 0)
                    return SocketConnectionResult.InvalidProxyResponse;
                if (buffer[3] != 1 && buffer[3] != 3 && buffer[3] != 4)
                    return SocketConnectionResult.InvalidProxyResponse;

                AddressType boundAddress = (AddressType)buffer[3];
                if (boundAddress == AddressType.IPv4)
                {
                    if (received != 10)
                        return SocketConnectionResult.InvalidProxyResponse;
                }
                else if (boundAddress == AddressType.IPv6)
                {
                    if (received != 22)
                        return SocketConnectionResult.InvalidProxyResponse;
                }
                else
                {
                    int domainLength = buffer[4];
                    if (received != 7 + domainLength)
                        return SocketConnectionResult.InvalidProxyResponse;
                }

                return SocketConnectionResult.OK;
            }
            catch (SocketException ex)
            {
                return ex.ToConnectionResult();
            }
            catch
            {
                return SocketConnectionResult.UnknownError;
            }
        }

        private const byte SubnegotiationVersion = 0x01;
        private const byte SocksVersion = 0x05;

        private static byte[] BuildHelloMessage(bool doUsernamePasswordAuth)
        {
            byte[] hello = new byte[doUsernamePasswordAuth ? 4 : 3];
            hello[0] = SocksVersion;
            hello[1] = (byte)(doUsernamePasswordAuth ? 2 : 1);
            hello[2] = (byte)Authentication.NoAuthentication;
            if (doUsernamePasswordAuth)
            {
                hello[3] = (byte)Authentication.UsernamePassword;
            }
            return hello;
        }
        private static byte[] BuildRequestMessage(Command command, AddressType addressType, string address, int port)
        {
            int addressLength;
            byte[] addressBytes;
            switch (addressType)
            {
                case AddressType.IPv4:
                case AddressType.IPv6:
                    addressBytes = IPAddress.Parse(address).GetAddressBytes();
                    addressLength = addressBytes.Length;
                    break;

                case AddressType.DomainName:
                    byte[] domainBytes = Encoding.UTF8.GetBytes(address);
                    addressLength = 1 + domainBytes.Length;
                    addressBytes = new byte[addressLength];
                    addressBytes[0] = (byte)domainBytes.Length;
                    Array.Copy(domainBytes, 0, addressBytes, 1, domainBytes.Length);
                    break;

                default:
                    throw new ArgumentException("Unknown address type");
            }

            byte[] request = new byte[6 + addressLength];
            request[0] = SocksVersion;
            request[1] = (byte)command;
            //request[2] = 0x00;
            request[3] = (byte)addressType;
            Array.Copy(addressBytes, 0, request, 4, addressLength);
            request[request.Length - 2] = (byte)(port / 256);
            request[request.Length - 1] = (byte)(port % 256);
            return request;
        }
        public static byte[] BuildAuthenticationMessage(string username, string password)
        {
            byte[] usernameBytes = Encoding.UTF8.GetBytes(username);
            if (usernameBytes.Length > 255) throw new ArgumentOutOfRangeException("Username is too long");

            byte[] passwordBytes = Encoding.UTF8.GetBytes(password);
            if (passwordBytes.Length > 255) throw new ArgumentOutOfRangeException("Password is too long");

            byte[] authMessage = new byte[3 + usernameBytes.Length + passwordBytes.Length];
            authMessage[0] = SubnegotiationVersion;
            authMessage[1] = (byte)usernameBytes.Length;
            Array.Copy(usernameBytes, 0, authMessage, 2, usernameBytes.Length);
            authMessage[2 + usernameBytes.Length] = (byte)passwordBytes.Length;
            Array.Copy(passwordBytes, 0, authMessage, 3 + usernameBytes.Length, passwordBytes.Length);
            return authMessage;
        }
    }
    /// <summary>
    /// Presents itself as an HTTP(s) proxy, but connects to a SOCKS5 proxy behind-the-scenes
    /// </summary>
    public class HttpToSocks5Proxy : IWebProxy
    {
        /// <summary>
        /// Ignored by this <see cref="IWebProxy"/> implementation
        /// </summary>
        public ICredentials Credentials { get; set; }
        /// <summary>
        /// Returned <see cref="Uri"/> is constant for a single <see cref="HttpToSocks5Proxy"/> instance
        /// <para>Address is a local address, the port is <see cref="InternalServerPort"/></para>
        /// </summary>
        /// <param name="destination">Ignored by this <see cref="IWebProxy"/> implementation</param>
        /// <returns></returns>
        public Uri GetProxy(Uri destination) { return ProxyUri; }
        /// <summary>
        /// Always returns false
        /// </summary>
        /// <param name="host">Ignored by this <see cref="IWebProxy"/> implementation</param>
        /// <returns></returns>
        public bool IsBypassed(Uri host) { return false; }
        /// <summary>
        /// The port on which the internal server is listening
        /// </summary>
        public int InternalServerPort { get; private set; }

        /// <summary>
        /// A custom domain name resolver
        /// </summary>
        public IDnsResolver DnsResolver
        {
            set
            {
                if (value != null)
                {
                    dnsResolver = value;
                }
                else
                {
                    throw new ArgumentNullException("value");
                }
            }
        }
        private IDnsResolver dnsResolver;

        private readonly Uri ProxyUri;
        private readonly Socket InternalServerSocket;

        private readonly ProxyInfo[] ProxyList;

        /// <summary>
        /// Controls whether domain names are resolved locally or passed to the proxy server for evaluation
        /// <para>False by default</para>
        /// </summary>
        public bool ResolveHostnamesLocally = false;

        #region Constructors
        /// <summary>
        /// Create an Http(s) to Socks5 proxy using no authentication
        /// </summary>
        /// <param name="socks5Hostname">IP address or hostname of the Socks5 proxy server</param>
        /// <param name="socks5Port">Port of the Socks5 proxy server</param>
        /// <param name="internalServerPort">The port to listen on with the internal server, 0 means it is selected automatically</param>
        public HttpToSocks5Proxy(string socks5Hostname, int socks5Port, int internalServerPort = 0)
            : this(new[] { new ProxyInfo(socks5Hostname, socks5Port) }, internalServerPort) { }

        /// <summary>
        /// Create an Http(s) to Socks5 proxy using username and password authentication
        /// <para>Note that many public Socks5 servers don't actually require a username and password</para>
        /// </summary>
        /// <param name="socks5Hostname">IP address or hostname of the Socks5 proxy server</param>
        /// <param name="socks5Port">Port of the Socks5 proxy server</param>
        /// <param name="username">Username for the Socks5 server authentication</param>
        /// <param name="password">Password for the Socks5 server authentication</param>
        /// <param name="internalServerPort">The port to listen on with the internal server, 0 means it is selected automatically</param>
        public HttpToSocks5Proxy(string socks5Hostname, int socks5Port, string username, string password, int internalServerPort = 0)
            : this(new[] { new ProxyInfo(socks5Hostname, socks5Port, username, password) }, internalServerPort) { }

        /// <summary>
        /// Create an Http(s) to Socks5 proxy using one or multiple chained proxies
        /// </summary>
        /// <param name="proxyList">List of proxies to route through</param>
        /// <param name="internalServerPort">The port to listen on with the internal server, 0 means it is selected automatically</param>
        public HttpToSocks5Proxy(ProxyInfo[] proxyList, int internalServerPort = 0)
        {
            if (internalServerPort < 0 || internalServerPort > 65535) throw new ArgumentOutOfRangeException("internalServerPort");
            if (proxyList == null) throw new ArgumentNullException("proxyList");
            if (proxyList.Length == 0) throw new ArgumentException("proxyList is empty", "proxyList");
            if (proxyList.Any(p => p == null)) throw new ArgumentNullException("proxyList", "Proxy in proxyList is null");

            ProxyList = proxyList;
            InternalServerPort = internalServerPort;
            dnsResolver = new DefaultDnsResolver();

            InternalServerSocket = CreateSocket();
            InternalServerSocket.Bind(new IPEndPoint(IPAddress.Any, InternalServerPort));

            if (InternalServerPort == 0)
                InternalServerPort = ((IPEndPoint)(InternalServerSocket.LocalEndPoint)).Port;

            ProxyUri = new Uri("http://127.0.0.1:" + InternalServerPort);
            InternalServerSocket.Listen(8);
            InternalServerSocket.BeginAccept(OnAcceptCallback, null);
        }
        #endregion

        private void OnAcceptCallback(IAsyncResult AR)
        {
            if (Stopped) return;

            Socket clientSocket = null;
            try
            {
                clientSocket = InternalServerSocket.EndAccept(AR);
            }
            catch { }

            try
            {
                InternalServerSocket.BeginAccept(OnAcceptCallback, null);
            }
            catch { StopInternalServer(); }

            if (clientSocket != null)
                HandleRequest(clientSocket);
        }
        private void HandleRequest(Socket clientSocket)
        {
            Socket socks5Socket = null;
            bool success = true;

            try
            {
                string hostname;
                int port;
                string httpVersion;
                bool connect;
                string request;
                byte[] overRead;
                if (TryReadTarget(clientSocket, out hostname, out port, out httpVersion, out connect, out request, out overRead))
                {
                    try
                    {
                        socks5Socket = CreateSocket();
                        socks5Socket.Connect(dnsResolver.TryResolve(ProxyList[0].Hostname), ProxyList[0].Port);
                    }
                    catch (SocketException ex)
                    {
                        SendError(clientSocket, ex.ToConnectionResult());
                        success = false;
                    }
                    catch (Exception)
                    {
                        SendError(clientSocket, SocketConnectionResult.UnknownError);
                        success = false;
                    }

                    if (success)
                    {
                        SocketConnectionResult result;
                        for (int i = 0; i < ProxyList.Length - 1; i++)
                        {
                            var proxy = ProxyList[i];
                            var nextProxy = ProxyList[i + 1];
                            result = Socks5.TryCreateTunnel(socks5Socket, nextProxy.Hostname, nextProxy.Port, proxy, ResolveHostnamesLocally ? dnsResolver : null);
                            if (result != SocketConnectionResult.OK)
                            {
                                SendError(clientSocket, result, httpVersion);
                                success = false;
                                break;
                            }
                        }

                        if (success)
                        {
                            var lastProxy = ProxyList.Last();
                            result = Socks5.TryCreateTunnel(socks5Socket, hostname, port, lastProxy, ResolveHostnamesLocally ? dnsResolver : null);
                            if (result != SocketConnectionResult.OK)
                            {
                                SendError(clientSocket, result, httpVersion);
                                success = false;
                            }
                            else
                            {
                                if (!connect)
                                {
                                    SendString(socks5Socket, request);
                                    if (overRead != null)
                                    {
                                        socks5Socket.Send(overRead, SocketFlags.None);
                                    }
                                }
                                else
                                {
                                    SendString(clientSocket, httpVersion + "200 Connection established\r\nProxy-Agent: MihaZupan-HttpToSocks5Proxy\r\n\r\n");
                                }
                            }
                        }
                    }
                }
                else success = false;
            }
            catch
            {
                success = false;
                try
                {
                    SendError(clientSocket, SocketConnectionResult.UnknownError);
                }
                catch { }
            }
            finally
            {
                if (success)
                {
                    SocketRelay.RelayBiDirectionally(socks5Socket, clientSocket);
                }
                else
                {
                    clientSocket.TryDispose();
                    socks5Socket.TryDispose();
                }
            }
        }

        private static bool TryReadTarget(Socket clientSocket, out string hostname, out int port, out string httpVersion, out bool connect, out string request, out byte[] overReadBuffer)
        {
            hostname = null;
            port = -1;
            httpVersion = null;
            connect = false;
            request = null;

            string headerString;
            if (!TryReadHeaders(clientSocket, out headerString, out overReadBuffer))
                return false;

            List<string> headerLines = headerString.Split('\n').Select(i => i.TrimEnd('\r')).Where(i => i.Length > 0).ToList();
            string[] methodLine = headerLines[0].Split(' ');
            if (methodLine.Length != 3) // METHOD URI HTTP/X.Y
            {
                SendError(clientSocket, SocketConnectionResult.InvalidRequest);
                return false;
            }
            string method = methodLine[0];
            httpVersion = methodLine[2].Trim() + " ";
            connect = method.Equals("Connect", StringComparison.OrdinalIgnoreCase);
            string hostHeader = null;

            #region Host header
            if (connect)
            {
                foreach (var headerLine in headerLines)
                {
                    int colon = headerLine.IndexOf(':');
                    if (colon == -1)
                    {
                        SendError(clientSocket, SocketConnectionResult.InvalidRequest, httpVersion);
                        return false;
                    }
                    string headerName = headerLine.Substring(0, colon).Trim();
                    if (headerName.Equals("Host", StringComparison.OrdinalIgnoreCase))
                    {
                        hostHeader = headerLine.Substring(colon + 1).Trim();
                        break;
                    }
                }
            }
            else
            {
                var hostUri = new Uri(methodLine[1]);

                StringBuilder requestBuilder = new StringBuilder();

                requestBuilder.Append(methodLine[0]);
                requestBuilder.Append(' ');
                requestBuilder.Append(hostUri.PathAndQuery);
                requestBuilder.Append(hostUri.Fragment);
                requestBuilder.Append(' ');
                requestBuilder.Append(methodLine[2]);

                for (int i = 1; i < headerLines.Count; i++)
                {
                    int colon = headerLines[i].IndexOf(':');
                    if (colon == -1) continue; // Invalid header found (no colon separator) - skip it instead of aborting the connection
                    string headerName = headerLines[i].Substring(0, colon).Trim();

                    if (headerName.Equals("Host", StringComparison.OrdinalIgnoreCase))
                    {
                        hostHeader = headerLines[i].Substring(colon + 1).Trim();
                        requestBuilder.Append("\r\n");
                        requestBuilder.Append(headerLines[i]);
                    }
                    else if (!headerName.IsHopByHopHeader())
                    {
                        requestBuilder.Append("\r\n");
                        requestBuilder.Append(headerLines[i]);
                    }
                }
                if (hostHeader == null)
                {
                    // Desperate attempt at salvaging a connection without a host header
                    requestBuilder.Append("\r\nHost: ");
                    requestBuilder.Append(hostUri.Host);
                }
                requestBuilder.Append("\r\n\r\n");
                request = requestBuilder.ToString();
            }
            #endregion Host header

            #region Hostname and port
            port = connect ? 443 : 80;

            if (string.IsNullOrEmpty(hostHeader))
            {
                // Host was not found in the host header
                string requestTarget = methodLine[1];
                hostname = requestTarget;
                int colon = requestTarget.LastIndexOf(':');
                if (colon != -1)
                {
                    if (int.TryParse(requestTarget.Substring(colon + 1), out port))
                    {
                        // A port was specified in the first line (method line)
                        hostname = requestTarget.Substring(0, colon);
                    }
                    else port = connect ? 443 : 80;
                }
            }
            else
            {
                int colon = hostHeader.LastIndexOf(':');
                if (colon == -1)
                {
                    // Host was found in the header, but we'll still look for a port in the method line
                    hostname = hostHeader;
                    string requestTarget = methodLine[1];
                    colon = requestTarget.LastIndexOf(':');
                    if (colon != -1)
                    {
                        if (!int.TryParse(requestTarget.Substring(colon + 1), out port))
                            port = connect ? 443 : 80;
                    }
                }
                else
                {
                    // Host was found in the header, it could also contain a port
                    hostname = hostHeader.Substring(0, colon);
                    if (!int.TryParse(hostHeader.Substring(colon + 1), out port))
                        port = connect ? 443 : 80;
                }
            }
            #endregion Hostname and port

            return true;
        }
        private static bool TryReadHeaders(Socket clientSocket, out string headers, out byte[] overRead)
        {
            headers = null;
            overRead = null;

            var headersBuffer = new byte[8192];
            int received = 0;
            int left = 8192;
            int offset;
            int endOfHeader;
            // According to https://stackoverflow.com/a/686243/6845657 even Apache gives up after 8KB

            do
            {
                if (left == 0)
                {
                    SendError(clientSocket, SocketConnectionResult.InvalidRequest);
                    return false;
                }
                offset = received;
                int read = clientSocket.Receive(headersBuffer, received, left, SocketFlags.None);
                if (read == 0)
                {
                    return false;
                }
                received += read;
                left -= read;
            }
            // received - 3 is used because we could have read the start of the double new line in the previous read
            while (!headersBuffer.ContainsDoubleNewLine(Math.Max(0, offset - 3), received, out endOfHeader));

            headers = Encoding.ASCII.GetString(headersBuffer, 0, endOfHeader);

            if (received != endOfHeader)
            {
                int overReadCount = received - endOfHeader;
                overRead = new byte[overReadCount];
                Array.Copy(headersBuffer, endOfHeader, overRead, 0, overReadCount);
            }

            return true;
        }

        private static void SendString(Socket socket, string text)
        {
            socket.Send(Encoding.UTF8.GetBytes(text));
        }
        private static void SendError(Socket socket, SocketConnectionResult error, string httpVersion = "HTTP/1.1 ")
        {
            SendString(socket, ErrorResponseBuilder.Build(error, httpVersion));
        }

        private static Socket CreateSocket()
        {
            return new Socket(SocketType.Stream, ProtocolType.Tcp);
        }

        private bool Stopped = false;
        public void StopInternalServer()
        {
            if (Stopped) return;
            Stopped = true;
            InternalServerSocket.Close();
        }
    }
}