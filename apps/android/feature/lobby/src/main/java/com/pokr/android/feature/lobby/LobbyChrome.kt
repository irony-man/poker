package com.pokr.android.feature.lobby

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.mandatorySystemGestures
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pokr.android.core.designsystem.PokrChrome
import com.pokr.android.core.designsystem.PokrColors
import com.pokr.android.core.designsystem.PokrFonts
import com.pokr.android.core.designsystem.PokrLabel
import com.pokr.android.core.designsystem.PokrPrimaryButton
import com.pokr.android.core.designsystem.PokrRadius
import com.pokr.android.core.designsystem.HudPanel
import com.pokr.android.core.designsystem.LocalPokrUiTheme
import com.pokr.android.core.designsystem.PlayerAvatar
import com.pokr.android.core.designsystem.PokrLogo
import com.pokr.android.core.designsystem.PokrUiTheme
import com.pokr.android.core.designsystem.arcadeOffsetShadow
import com.pokr.android.core.designsystem.pokrChoiceChipSurface
import com.pokr.android.core.designsystem.pokrChoiceForeground
import com.pokr.android.core.designsystem.R as DsR

enum class LobbyTab {
    Home,
    Play,
    Public,
    Contests,
    Friends,
    Offline,
}

@Composable
fun LobbyTopBar(
    avatarId: Int,
    avatarUrl: String?,
    onAvatarClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(PokrColors.Sidebar)
            .statusBarsPadding()
            .padding(horizontal = 16.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PokrLogo(height = 28.dp)
        Box(
            modifier = Modifier
                .clip(CircleShape)
                .clickable(onClick = onAvatarClick)
                .border(1.5.dp, PokrColors.OnChrome.copy(alpha = 0.45f), CircleShape)
                .padding(2.dp),
        ) {
            PlayerAvatar(avatarId = avatarId, avatarUrl = avatarUrl, size = 36.dp)
        }
    }
}

@Composable
fun LobbyBottomNav(
    selected: LobbyTab,
    onSelect: (LobbyTab) -> Unit,
    onPlayClick: () -> Unit,
    friendsBadge: Int = 0,
    modifier: Modifier = Modifier,
) {
    val items = listOf(
        LobbyTab.Home to "Home",
        LobbyTab.Play to "Play",
        LobbyTab.Public to "Public",
        LobbyTab.Contests to "Contests",
        LobbyTab.Friends to "Friends",
        LobbyTab.Offline to "Offline",
    )
    val navInset = maxOf(
        WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding(),
        WindowInsets.mandatorySystemGestures.asPaddingValues().calculateBottomPadding(),
        16.dp,
    )
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(PokrColors.Sidebar)
            .padding(start = 4.dp, end = 4.dp, top = 10.dp, bottom = 10.dp + navInset),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        items.forEach { (tab, label) ->
            val active = selected == tab
            val color = if (active) PokrColors.OnChrome else PokrColors.OnChrome.copy(alpha = 0.55f)
            Column(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(10.dp))
                    .clickable {
                        if (tab == LobbyTab.Play) onPlayClick() else onSelect(tab)
                    }
                    .padding(vertical = 4.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Box {
                    LobbyNavIcon(tab = tab, active = active, color = color)
                    if (tab == LobbyTab.Friends && friendsBadge > 0) {
                        Text(
                            text = if (friendsBadge > 9) "9+" else friendsBadge.toString(),
                            color = PokrColors.Sidebar,
                            fontFamily = PokrFonts.Display,
                            fontWeight = FontWeight.Bold,
                            fontSize = 8.sp,
                            modifier = Modifier
                                .align(Alignment.TopEnd)
                                .clip(CircleShape)
                                .background(PokrColors.Gold)
                                .padding(horizontal = 4.dp, vertical = 1.dp),
                        )
                    }
                }
                Text(
                    text = label.uppercase(),
                    color = color,
                    fontFamily = PokrFonts.Display,
                    fontWeight = if (active) FontWeight.Bold else FontWeight.SemiBold,
                    fontSize = 8.sp,
                    letterSpacing = 0.4.sp,
                    maxLines = 1,
                )
            }
        }
    }
}

@Composable
private fun LobbyNavIcon(tab: LobbyTab, active: Boolean, color: Color) {
    Canvas(modifier = Modifier.size(22.dp)) {
        val stroke = Stroke(
            width = if (active) 3.2f else 3.5f,
            cap = StrokeCap.Round,
            join = StrokeJoin.Round,
        )
        val style = if (active) Fill else stroke
        when (tab) {
            LobbyTab.Home -> {
                val p = Path().apply {
                    moveTo(size.width * 0.15f, size.height * 0.45f)
                    lineTo(size.width * 0.5f, size.height * 0.16f)
                    lineTo(size.width * 0.85f, size.height * 0.45f)
                    lineTo(size.width * 0.85f, size.height * 0.84f)
                    quadraticTo(size.width * 0.85f, size.height * 0.9f, size.width * 0.78f, size.height * 0.9f)
                    lineTo(size.width * 0.58f, size.height * 0.9f)
                    lineTo(size.width * 0.58f, size.height * 0.64f)
                    lineTo(size.width * 0.42f, size.height * 0.64f)
                    lineTo(size.width * 0.42f, size.height * 0.9f)
                    lineTo(size.width * 0.22f, size.height * 0.9f)
                    quadraticTo(size.width * 0.15f, size.height * 0.9f, size.width * 0.15f, size.height * 0.84f)
                    close()
                }
                drawPath(p, color, style = if (active) Fill else stroke)
            }
            LobbyTab.Play -> {
                drawOval(
                    color = color,
                    topLeft = androidx.compose.ui.geometry.Offset(size.width * 0.12f, size.height * 0.32f),
                    size = androidx.compose.ui.geometry.Size(size.width * 0.76f, size.height * 0.5f),
                    style = style,
                )
                drawLine(
                    color = color,
                    start = androidx.compose.ui.geometry.Offset(size.width * 0.5f, size.height * 0.32f),
                    end = androidx.compose.ui.geometry.Offset(size.width * 0.5f, size.height * 0.18f),
                    strokeWidth = 3.2f,
                    cap = StrokeCap.Round,
                )
                drawCircle(
                    color = color,
                    radius = size.minDimension * 0.08f,
                    center = androidx.compose.ui.geometry.Offset(size.width * 0.5f, size.height * 0.14f),
                )
            }
            LobbyTab.Public -> {
                drawCircle(color, radius = size.minDimension * 0.38f, style = stroke)
                drawOval(
                    color = color,
                    topLeft = androidx.compose.ui.geometry.Offset(size.width * 0.32f, size.height * 0.12f),
                    size = androidx.compose.ui.geometry.Size(size.width * 0.36f, size.height * 0.76f),
                    style = stroke,
                )
                drawLine(
                    color = color,
                    start = androidx.compose.ui.geometry.Offset(size.width * 0.14f, size.height * 0.5f),
                    end = androidx.compose.ui.geometry.Offset(size.width * 0.86f, size.height * 0.5f),
                    strokeWidth = 3.2f,
                    cap = StrokeCap.Round,
                )
            }
            LobbyTab.Contests -> {
                val cup = Path().apply {
                    moveTo(size.width * 0.32f, size.height * 0.18f)
                    lineTo(size.width * 0.68f, size.height * 0.18f)
                    lineTo(size.width * 0.68f, size.height * 0.4f)
                    quadraticTo(size.width * 0.68f, size.height * 0.58f, size.width * 0.5f, size.height * 0.58f)
                    quadraticTo(size.width * 0.32f, size.height * 0.58f, size.width * 0.32f, size.height * 0.4f)
                    close()
                }
                drawPath(cup, color, style = style)
                drawLine(
                    color = color,
                    start = androidx.compose.ui.geometry.Offset(size.width * 0.5f, size.height * 0.58f),
                    end = androidx.compose.ui.geometry.Offset(size.width * 0.5f, size.height * 0.72f),
                    strokeWidth = 3.2f,
                    cap = StrokeCap.Round,
                )
                drawLine(
                    color = color,
                    start = androidx.compose.ui.geometry.Offset(size.width * 0.36f, size.height * 0.84f),
                    end = androidx.compose.ui.geometry.Offset(size.width * 0.64f, size.height * 0.84f),
                    strokeWidth = 3.2f,
                    cap = StrokeCap.Round,
                )
            }
            LobbyTab.Friends -> {
                drawCircle(
                    color = color,
                    radius = size.minDimension * 0.14f,
                    center = androidx.compose.ui.geometry.Offset(size.width * 0.38f, size.height * 0.32f),
                    style = style,
                )
                drawCircle(
                    color = color,
                    radius = size.minDimension * 0.11f,
                    center = androidx.compose.ui.geometry.Offset(size.width * 0.68f, size.height * 0.34f),
                    style = style,
                )
                val body = Path().apply {
                    moveTo(size.width * 0.16f, size.height * 0.82f)
                    quadraticTo(size.width * 0.16f, size.height * 0.58f, size.width * 0.38f, size.height * 0.54f)
                    lineTo(size.width * 0.5f, size.height * 0.54f)
                    quadraticTo(size.width * 0.68f, size.height * 0.58f, size.width * 0.7f, size.height * 0.82f)
                }
                drawPath(body, color, style = stroke)
            }
            LobbyTab.Offline -> {
                drawRoundRect(
                    color = color,
                    topLeft = androidx.compose.ui.geometry.Offset(size.width * 0.24f, size.height * 0.32f),
                    size = androidx.compose.ui.geometry.Size(size.width * 0.52f, size.height * 0.5f),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(6f, 6f),
                    style = style,
                )
                drawCircle(
                    color = color,
                    radius = size.minDimension * 0.06f,
                    center = androidx.compose.ui.geometry.Offset(size.width * 0.4f, size.height * 0.54f),
                )
                drawCircle(
                    color = color,
                    radius = size.minDimension * 0.06f,
                    center = androidx.compose.ui.geometry.Offset(size.width * 0.6f, size.height * 0.54f),
                )
            }
        }
    }
}

@Composable
fun LobbyPageHeader(
    title: String,
    subtitle: String,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = title,
            color = PokrColors.Sidebar,
            fontFamily = PokrFonts.Display,
            fontWeight = FontWeight.ExtraBold,
            fontSize = 28.sp,
            lineHeight = 32.sp,
        )
        Text(
            text = subtitle,
            color = PokrColors.InkStrongMuted,
            fontSize = 15.sp,
            lineHeight = 22.sp,
        )
    }
}

@Composable
fun LobbySplitCard(
    imageRes: Int,
    imageAlt: String,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(4f / 3f),
            contentAlignment = Alignment.Center,
        ) {
            Image(
                painter = painterResource(imageRes),
                contentDescription = imageAlt,
                modifier = Modifier.fillMaxWidth(),
                contentScale = ContentScale.Fit,
            )
        }
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(PokrRadius.Xl))
                .background(PokrColors.White)
                .border(1.dp, PokrColors.Sidebar.copy(alpha = 0.1f), RoundedCornerShape(PokrRadius.Xl))
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
            content = content,
        )
    }
}

@Composable
fun LobbyScrollColumn(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier = modifier
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 18.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        content = content,
    )
}

@Composable
fun SignInGate(
    onGoHome: () -> Unit,
    modifier: Modifier = Modifier,
) {
    HudPanel(modifier = modifier.fillMaxWidth(), chrome = PokrChrome.Lobby) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(
                "Sign in to continue",
                color = PokrColors.Sidebar,
                fontFamily = PokrFonts.Display,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
            )
            Text(
                "Host, join, public tables, contests, and friends need an account.",
                color = PokrColors.InkStrongMuted,
                fontSize = 14.sp,
                lineHeight = 20.sp,
            )
            PokrPrimaryButton(
                text = "Sign in",
                onClick = onGoHome,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
fun PlayHostJoinMenu(
    onHost: () -> Unit,
    onJoin: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .width(148.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(PokrColors.Sidebar)
            .border(1.dp, PokrColors.OnChrome.copy(alpha = 0.15f), RoundedCornerShape(12.dp)),
    ) {
        PlayMenuItem(text = "Host", onClick = onHost)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(1.dp)
                .background(PokrColors.OnChrome.copy(alpha = 0.1f)),
        )
        PlayMenuItem(text = "Join", onClick = onJoin)
    }
}

@Composable
private fun PlayMenuItem(text: String, onClick: () -> Unit) {
    Text(
        text = text,
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        color = PokrColors.OnChrome,
        fontFamily = PokrFonts.Display,
        fontWeight = FontWeight.SemiBold,
        fontSize = 14.sp,
    )
}

@Composable
fun LobbyTextField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String? = null,
    numeric: Boolean = false,
    password: Boolean = false,
) {
    val shape = RoundedCornerShape(PokrRadius.Md)
    val interactionSource = remember { MutableInteractionSource() }
    val focused by interactionSource.collectIsFocusedAsState()
    val textStyle = TextStyle(
        color = PokrColors.InkStrong,
        fontFamily = PokrFonts.Body,
        fontSize = 14.sp,
        lineHeight = 18.sp,
    )
    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
        textStyle = textStyle,
        cursorBrush = SolidColor(PokrColors.Sidebar),
        interactionSource = interactionSource,
        visualTransformation = if (password) PasswordVisualTransformation() else VisualTransformation.None,
        keyboardOptions = KeyboardOptions(
            keyboardType = when {
                password -> KeyboardType.Password
                numeric -> KeyboardType.Number
                else -> KeyboardType.Text
            },
            imeAction = ImeAction.Done,
        ),
        decorationBox = { inner ->
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(40.dp)
                    .clip(shape)
                    .background(PokrColors.Mushroom.copy(alpha = 0.55f))
                    .border(
                        width = 1.dp,
                        color = if (focused) PokrColors.Sidebar.copy(alpha = 0.45f)
                        else PokrColors.Sidebar.copy(alpha = 0.15f),
                        shape = shape,
                    )
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                contentAlignment = Alignment.CenterStart,
            ) {
                if (value.isEmpty() && placeholder != null) {
                    Text(
                        text = placeholder,
                        color = PokrColors.InkStrongMuted.copy(alpha = 0.65f),
                        fontSize = 14.sp,
                        lineHeight = 18.sp,
                        fontFamily = PokrFonts.Body,
                    )
                }
                inner()
            }
        },
    )
}

@Composable
fun ChoiceRow(
    label: String,
    selected: Int,
    options: List<Int>,
    onSelect: (Int) -> Unit,
    style: ChoiceStyle = ChoiceStyle.Chip,
    format: (Int) -> String = { it.toString() },
) {
    SegmentedChoice(
        label = label,
        selected = selected,
        options = options,
        onSelect = onSelect,
        format = format,
        style = style,
    )
}

@Composable
fun ChoiceRowString(
    label: String,
    selected: String,
    options: List<String>,
    onSelect: (String) -> Unit,
    style: ChoiceStyle = ChoiceStyle.Chip,
    format: (String) -> String = { it },
) {
    SegmentedChoice(
        label = label,
        selected = selected,
        options = options,
        onSelect = onSelect,
        format = format,
        style = style,
    )
}

/** Matches web `ChoiceStyle`: `chip` (outline wrap) vs `segmented` (pill track + solid selected). */
enum class ChoiceStyle { Chip, Segmented }

/**
 * Choice control — web `ChoiceRow` / `Tabs`.
 * - [ChoiceStyle.Chip]: outline chips (seats, stakes, table size)
 * - [ChoiceStyle.Segmented]: full-width track with solid purple selected tab
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun <T> SegmentedChoice(
    selected: T,
    options: List<T>,
    onSelect: (T) -> Unit,
    label: String? = null,
    style: ChoiceStyle = ChoiceStyle.Chip,
    content: (@Composable (option: T, selected: Boolean) -> Unit)? = null,
    format: (T) -> String = { it.toString() },
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (label != null) PokrLabel(label)
        when (style) {
            ChoiceStyle.Segmented -> SegmentedTrack(
                selected = selected,
                options = options,
                onSelect = onSelect,
                content = content,
                format = format,
            )
            ChoiceStyle.Chip -> ChipTrack(
                selected = selected,
                options = options,
                onSelect = onSelect,
                content = content,
                format = format,
            )
        }
    }
}

@Composable
private fun <T> SegmentedTrack(
    selected: T,
    options: List<T>,
    onSelect: (T) -> Unit,
    content: (@Composable (option: T, selected: Boolean) -> Unit)?,
    format: (T) -> String,
) {
    val arcade = LocalPokrUiTheme.current == PokrUiTheme.Arcade
    val trackShape = RoundedCornerShape(12.dp)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .then(
                if (arcade) Modifier.arcadeOffsetShadow(trackShape, offset = 3.dp)
                else Modifier.clip(trackShape),
            )
            .background(
                if (arcade) PokrColors.White else PokrColors.Mushroom.copy(alpha = 0.5f),
                trackShape,
            )
            .border(
                if (arcade) 2.dp else 1.dp,
                if (arcade) Color.Black else PokrColors.Sidebar.copy(alpha = 0.15f),
                trackShape,
            )
            .padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(0.dp),
    ) {
        options.forEach { option ->
            val selectedOption = option == selected
            val optionShape = RoundedCornerShape(PokrRadius.Md)
            Box(
                modifier = Modifier
                    .weight(1f)
                    .heightIn(min = 40.dp)
                    .then(
                        if (selectedOption && !arcade) {
                            Modifier.shadow(
                                elevation = 6.dp,
                                shape = optionShape,
                                ambientColor = PokrColors.Sidebar.copy(alpha = 0.18f),
                                spotColor = PokrColors.Sidebar.copy(alpha = 0.18f),
                            )
                        } else {
                            Modifier
                        },
                    )
                    .clip(optionShape)
                    .background(
                        when {
                            !selectedOption -> Color.Transparent
                            arcade -> PokrColors.Mushroom
                            else -> PokrColors.Sidebar
                        },
                    )
                    .clickable { onSelect(option) }
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                contentAlignment = Alignment.Center,
            ) {
                if (content != null) {
                    content(option, selectedOption)
                } else {
                    Text(
                        text = format(option).uppercase(),
                        color = when {
                            selectedOption && arcade -> PokrColors.InkStrong
                            selectedOption -> PokrColors.OnChrome
                            else -> PokrColors.InkStrongMuted
                        },
                        fontFamily = PokrFonts.Display,
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp,
                        letterSpacing = 0.8.sp,
                        lineHeight = 16.sp,
                        textAlign = TextAlign.Center,
                        maxLines = 1,
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun <T> ChipTrack(
    selected: T,
    options: List<T>,
    onSelect: (T) -> Unit,
    content: (@Composable (option: T, selected: Boolean) -> Unit)?,
    format: (T) -> String,
) {
    val arcade = LocalPokrUiTheme.current == PokrUiTheme.Arcade
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(if (arcade) 10.dp else 8.dp),
        verticalArrangement = Arrangement.spacedBy(if (arcade) 10.dp else 8.dp),
    ) {
        options.forEach { option ->
            val selectedOption = option == selected
            val shape = RoundedCornerShape(PokrRadius.Md)
            Box(
                modifier = Modifier
                    .widthIn(min = 44.dp)
                    .pokrChoiceChipSurface(selected = selectedOption, shape = shape, arcade = arcade)
                    .clickable { onSelect(option) }
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                contentAlignment = Alignment.Center,
            ) {
                if (content != null) {
                    content(option, selectedOption)
                } else {
                    Text(
                        text = format(option),
                        color = pokrChoiceForeground(selected = selectedOption, arcade = arcade),
                        fontFamily = PokrFonts.Display,
                        fontWeight = if (selectedOption) FontWeight.Bold else FontWeight.SemiBold,
                        fontSize = 13.sp,
                        lineHeight = 16.sp,
                        textAlign = TextAlign.Center,
                        maxLines = 2,
                    )
                }
            }
        }
    }
}

@Composable
fun FieldHelp(text: String) {
    Text(
        text = text,
        color = PokrColors.InkStrongMuted,
        fontSize = 13.sp,
        lineHeight = 18.sp,
    )
}

object LobbyIllustrations {
    val offline = DsR.drawable.home_offline
    val host = DsR.drawable.host_table
    val join = DsR.drawable.join_table
    val publicTables = DsR.drawable.public_tables
    val contests = DsR.drawable.home_knockout
}
